// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as fs from 'fs';
import * as _path from 'path';
import {PassThrough, Readable, Transform, Writable} from 'stream';

import {logger} from './emitter';
import * as walker from './walker';

const log = logger(__filename);


// had conversation with isaacs about making changes to node-tar so we dont have
// to do this. todo: link issue

// tslint:disable-next-line:variable-name
const Header = require('tar/lib/header');
// tslint:disable-next-line:variable-name
const ReadEntry = require('tar/lib/read-entry');
// tslint:disable-next-line:variable-name
const Pack = require('tar/lib/pack.js');
const modeFix = require('tar/lib/mode-fix');


export type PackOptions = {
  // tslint:disable-next-line:no-any
  tar?: {[k: string]: any}
}&walker.Options;

export const pack =
    (paths: {[toPath: string]: string|CustomFile}|string,
     options?: PackOptions) => {
      // thanks typescript.
      let pathObj: {[toPath: string]: string|CustomFile} = {};
      if (typeof paths === 'string') {
        pathObj[paths] = paths;
      } else {
        pathObj = paths;
      }

      options = options || {};

      const outer: Transform&
          {_debug_entries_written?: number, _debug_entries_paused?: number} =
              new Transform({
                transform(chunk, enc, cb) {
                  cb(undefined, chunk);
                }
              });

      outer._debug_entries_written = 0;
      outer._debug_entries_paused = 0;

      // flatten every link into the tree its in
      options.find_links = false;
      options.no_return = true;

      let ends = 0;
      let starts = 0;

      const queue:
          Array<{path: string, toPath: string, stat: fs.Stats | CustomFile}> =
              [];

      // tar gzip:false etc.
      const pack = new Pack(
          Object.assign({}, options.tar || {}, {gzip: false, jobs: Infinity}));

      let working = false;
      let paused = 0;
      let ended = false;
      const work = () => {
        if (working || paused) {
          if (paused === 1) {
            paused++;
          }
          return;
        }
        const obj = queue.shift();
        if (!obj) {
          if (walkEnded && !ended) {
            ended = true;
            pack.end();
          }
          return;
        }
        working = true;
        starts++;
        let entry;
        const {path, stat, toPath} = obj;

        entry = pathToReadEntry({path, stat, toPath, portable: false});

        entry.on('end', () => {
          ends++;
          working = false;
          work();
        });

        entry.on('pause', () => {
          console.log('entry paused');
        });

        entry.on('error', (err: Error) => {
          pack.emit('error', err);
        });

        // this is for testing back pressure propagation.
        outer._debug_entries_written!++;

        if (!pack.write(entry)) {
          paused = 1;
          outer._debug_entries_paused!++;
        }
      };

      pack.on('drain', () => {
        paused = 0;
        work();
      });


      let walkEnded = false;

      const walks: Array<Promise<{}>> = [];
      Object.keys(pathObj).forEach((toPath) => {
        let path = pathObj[toPath];

        if (path instanceof CustomFile) {
          queue.push({
            path: toPath,
            toPath,
            stat: path,
          });
          return work();
        }
        path = _path.resolve(path);

        // tslint:disable-next-line:only-arrow-functions
        walks.push(walker.walk(path, options, function(file, stat) {
          queue.push({
            path: file,
            toPath: _path.join(toPath, file.replace(path as string, '')),
            stat,
          });
          work();
        }));
      });


      Promise.all(walks)
          .then(() => {
            walkEnded = true;
            if (!queue.length && !working) {
              pack.end();
            }
          })
          .catch((e) => {
            outer.emit('error', e);
          });

      return pack.pipe(outer);
    };

function pathToReadEntry(opts: {
  path: string,
  toPath?: string,
  linkpath?: string, stat: fs.Stats|CustomFile,
  mtime?: number,
  noMtime?: boolean, portable: boolean,
}) {
  const {path, stat} = opts;
  const linkpath = opts.linkpath;

  let {toPath} = opts;
  if (!stat) {
    throw new Error('stat missing for ' + opts);
  }

  const myuid = process.getuid && process.getuid();
  const myuser = process.env.USER || '';

  // settings.
  // override mtime.
  const mtime = opts.mtime;
  // dont write an mtime
  const noMtime = opts.noMtime;
  // dont write anything other than size, linkpath, path and mode
  const portable = opts.portable || true;

  // add trailing / to directory paths
  toPath = toPath || path;

  if (process.platform === 'win32') {
    if (_path.isAbsolute(toPath) && toPath.indexOf(':\\\\') > -1) {
      toPath = (toPath.split(':\\\\')[1] || toPath);
    }
    toPath = toPath.split(_path.sep).join(_path.posix.sep);
  }

  if (stat.isDirectory() && toPath.substr(-1) !== '/') {
    toPath += '/';
  }

  const header = new Header({
                   path: toPath.replace(/\\/g, '/'),
                   // if this is a link. the path the link points to.
                   linkpath: linkpath || (stat as CustomFile).linkPath,
                   mode: modeFix(stat.mode, stat.isDirectory()),
                   uid: portable ? null : stat.uid || 0,
                   gid: portable ? null : stat.gid || 0,
                   size: stat.isDirectory() ? 0 : stat.size,
                   mtime: noMtime ? null : mtime || stat.mtime,
                   type: statToType(stat) || 'File',
                   uname: portable ? null : stat.uid === myuid ? myuser : '',
                   atime: portable ? null : stat.atime,
                   ctime: portable ? null : stat.ctime
                 }) as Header;

  const entry = new ReadEntry(header) as ReadEntry;

  if (stat instanceof CustomFile) {
    if (stat.data) {
      if ((stat.data as Readable).pipe) {
        (stat.data as Readable).pipe(entry);
      } else {
        // if we write the entry data directly via entry.write it causes the
        // entry stream to never complete.
        const ps = new PassThrough();
        ps.pause();
        ps.on('resume', () => {
          ps.end(stat.data);
        });
        ps.pipe(entry);
      }
    } else {
      entry.end();
    }
  } else if (stat.isFile()) {
    fs.createReadStream(path).pipe(entry);
  } else {
    entry.end();
  }

  return entry;
}

export class CustomFile {
  mode: number;
  linkPath?: string;
  data?: Buffer|Readable;
  uid = 1;
  gid = 1;
  ctime = new Date();
  atime = new Date();
  mtime = new Date();
  size = 0;

  constructor(opts: {
    mode?: number,  // 0
    type?: string,
    linkPath?: string,
    data?: Buffer|Readable,
    size?: number
  }) {
    const type = opts.type || 'File';
    // Take permissions from mode. Then set file type.
    this.mode = ((opts.mode || 0) & 0o7777) | entryTypeToMode(type) | 0o644;
    this.linkPath = opts.linkPath;
    this.data = opts.data;
    this.size = opts.size || 0;
    if (Buffer.isBuffer(opts.data)) {
      this.size = opts.data.length;
    } else if (!this.size && this.size !== 0 && type === 'File') {
      throw new Error(
          'if data is not a buffer and this CustomFile is a "File" `opts.size` is required');
    }
  }

  isDirectory() {
    return (this.mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;
  }

  isSymbolicLink() {
    return (this.mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
  }

  isFile() {
    return (this.mode & fs.constants.S_IFMT) === fs.constants.S_IFREG;
  }
}

function statToType(stat: fs.Stats|CustomFile) {
  if (stat.isDirectory()) return 'Directory';
  if (stat.isSymbolicLink()) return 'SymbolicLink';
  if (stat.isFile()) return 'File';
  // return nothing if unsupported.
  return;
}

function entryTypeToMode(type: string) {
  if (type === 'Directory') return fs.constants.S_IFDIR;
  if (type === 'SymbolicLink') return fs.constants.S_IFLNK;
  if (type === 'File') return fs.constants.S_IFREG;
  // return nothing if unsupported.
  throw new Error(
      'unsupported entry type ' + type +
      '. support types are "Directory", "SymbolicLink", "File"');
}

interface Header {
  // tslint:disable-next-line:no-any
  constructor(stat: {[k: string]: any}): Header;
  type: string;
  linkpath?: string;
}

interface ReadEntry extends Writable {
  constructor(): ReadEntry;
}
