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
import {Readable} from 'stream';

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
    (paths: {[fromPath: string]: string}|string, options?: PackOptions) => {
      // thanks typescript.
      let pathObj: {[fromPath: string]: string} = {};
      if (typeof paths === 'string') {
        pathObj[paths] = paths;
      } else {
        pathObj = paths;
      }

      options = options || {};

      // flatten every link into the tree its in
      options.find_links = false;
      options.no_return = true;

      let ends = 0;
      let starts = 0;

      const queue: Array<{path: string, toPath: string, stat: fs.Stats}> = [];

      // tar gzip:false etc.
      const pack = new Pack(
          Object.assign({}, options.tar || {}, {gzip: false, jobs: Infinity}));
      let working = false;
      const work = () => {
        if (working) return;

        const obj = queue.shift();
        if (!obj) {
          if (walkEnded) {
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
        entry.on('error', (err: Error) => {
          pack.emit('error', err);
        });
        pack.write(entry);
      };


      let walkEnded = false;

      const walks: Array<Promise<{}>> = [];
      Object.keys(pathObj).forEach((path) => {
        const toPath = pathObj[path];
        path = _path.resolve(path);
        // ill need to use this to pause and resume. TODO
        // tslint:disable-next-line:only-arrow-functions
        walks.push(walker.walk(path, options, function(file, stat) {
          queue.push({
            path: file,
            toPath: _path.join(toPath, file.replace(path, '')),
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
            pack.emit('error', e);
          });

      return pack as Readable;
    };

function pathToReadEntry(opts: {
  path: string,
  toPath?: string,
  linkpath?: string, stat: fs.Stats,
  mtime?: number,
  noMtime?: boolean, portable: boolean
}) {
  const {path, linkpath, stat} = opts;
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
  const portable = opts.portable;

  // add trailing / to directory paths
  toPath = toPath || path;
  if (stat.isDirectory() && path.substr(-1) !== '/') {
    toPath += '/';
  }

  const header = new Header({
    path: toPath,
    // if this is a link. the path the link points to.
    linkpath,
    mode: modeFix(stat.mode, stat.isDirectory()),
    uid: portable ? null : stat.uid,
    gid: portable ? null : stat.gid,
    size: stat.isDirectory() ? 0 : stat.size,
    mtime: noMtime ? null : mtime || stat.mtime,
    type: statToType(stat),
    uname: portable ? null : stat.uid === myuid ? myuser : '',
    atime: portable ? null : stat.atime,
    ctime: portable ? null : stat.ctime
  });

  const entry = new ReadEntry(header);

  if (stat.isFile()) {
    fs.createReadStream(path).pipe(entry);
  } else {
    entry.end();
  }

  return entry;
}


function statToType(stat: fs.Stats) {
  if (stat.isDirectory()) return 'Directory';
  if (stat.isSymbolicLink()) return 'SymbolicLink';
  if (stat.isFile()) return 'File';
  // return nothing if unsupported.
  return;
}
