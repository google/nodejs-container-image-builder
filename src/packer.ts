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

const tar = require('tar');
import * as walker from './walker';
import * as _path from 'path';
import * as fs from 'fs';
import {logger} from './emitter';

const log = logger(__filename);



// had conversation is issac about making changes to node-tar so we dont have to
// do this. todo: link issue
// tslint:disable-next-line:variable-name
const Header = require('tar/lib/header');
// tslint:disable-next-line:variable-name
const ReadEntry = require('tar/lib/read-entry');
// tslint:disable-next-line:variable-name
const Pack = require('tar/lib/pack.js');
const modeFix = require('tar/lib/mode-fix');
const {Transform} = require('stream');

// tslint:disable-next-line:no-any
export type PackOptions = {
  tar: {[k: string]: any}
}&walker.Options;

export const pack =
    (paths: {[fromPath: string]: string}|string, options: PackOptions) => {
      // thanks typescript.
      let pathObj: {[fromPath: string]: string} = {};
      if (typeof paths === 'string') {
        pathObj[paths] = paths;
      } else {
        pathObj = paths;
      }

      // flatten every link into the tree its in
      options.find_links = false;
      options.no_return = true;

      // tar gzip:false etc.
      const pack =
          new Pack(Object.assign({}, options.tar || {}, {gzip: false}));

      const toTar = new Transform({
        transform(
            chunk: {path: string, toPath: string, stat: fs.Stats},
            encoding: string, callback: (data?: Buffer|{}) => void) {
          const {path, stat, toPath} = chunk;
          log(['readEntry', chunk]);
          const entry = pathToReadEntry({path, stat, toPath, portable: false});
          callback(entry);
        },
        objectMode: true,
      });

      toTar.pipe(pack);

      const walks: Array<Promise<{}>> = [];
      Object.keys(pathObj).forEach((path) => {
        const toPath = pathObj[path];
        path = _path.resolve(path);
        // ill need to use this to pause and resume. TODO
        // tslint:disable-next-line:only-arrow-functions
        walks.push(walker.walk(path, options, function(file, stat) {
          toTar.write({
            path,
            toPath: _path.resolve(toPath, file.replace(path, '')),
            stat,
          });
        }));
      });

      Promise.all(walks).then();
    };

function pathToReadEntry(opts: {
  path: string,
  toPath?: string,
  linkpath?: string, stat: fs.Stats,
  mtime?: number,
  noMtime?: boolean, portable: boolean
}) {
  const {path, toPath, linkpath, stat} = opts;

  const myuid = process.getuid && process.getuid();
  const myuser = process.env.USER || '';

  // settings.
  // override mtime.
  const mtime = opts.mtime;
  // dont write an mtime
  const noMtime = opts.noMtime;
  // dont write anything other than size, linkpath, path and mode
  const portable = opts.portable;

  const header = new Header({
    path: toPath || path,
    // if this is a link. the path the link points to.
    linkpath,
    mode: modeFix(stat.mode, stat.isDirectory()),
    uid: portable ? null : stat.uid,
    gid: portable ? null : stat.gid,
    size: stat.size,
    mtime: noMtime ? null : mtime || stat.mtime,
    type: statToType(stat),
    uname: portable ? null : stat.uid === myuid ? myuser : '',
    atime: portable ? null : stat.atime,
    ctime: portable ? null : stat.ctime
  });

  const entry = new ReadEntry(header);
  fs.createReadStream(path).pipe(entry);

  return entry;
}


function statToType(stat: fs.Stats) {
  if (stat.isDirectory()) return 'Directory';
  if (stat.isSymbolicLink()) return 'SymbolicLink';
  if (stat.isFile()) return 'File';
  // return nothing if unsupported.
  return;
}
