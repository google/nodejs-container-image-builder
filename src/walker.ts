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
import * as micromatch from 'micromatch';
import * as path from 'path';
import * as walkdir from 'walkdir';

export type DirMap = {
  [dir: string]: string
};
export type Options =
    walkdir.WalkOptions&{ignores?: string[], ignoreFiles?: string[]};

export const walk = async (
    dir: string, options?: Options,
    onStat?: (path: string, stat: fs.Stats) => void) => {
  const cwd = process.cwd();
  const entryDir = path.resolve(cwd, dir);
  options = options || {};

  if ((options.ignores && options.ignores.length) ||
      (options.ignoreFiles && options.ignoreFiles.length)) {
    const ignoreTree: {[dir: string]: string[]} = {};
    const ignoreFiles = options.ignoreFiles || [];
    const ignores = options.ignores || [];
    const ignoreFilesMap: {[name: string]: 1} = {};
    ignoreFiles.forEach((name) => {
      ignoreFilesMap[name] = 1;
    });

    // add the ignores to the tree
    if (ignores.length) {
      ignoreTree[entryDir] = ignores;
    }

    const applyRules = (dir: string, files: string[]) => {
      const currentDir = dir;

      // walk <--- down the dir file path directory by directory checking for
      // rules in the tree. we know that rules will never be in directories
      // above any of our walked directories so we could optimize this to not
      // check those. this is complicated by the realpath from readlink.
      let i: number;

      while (dir.lastIndexOf(path.sep) > -1) {
        if (ignoreTree[dir]) {
          files = files.filter((file) => {
            let relativeToRuleSource =
                (currentDir + path.sep + file).replace(dir + path.sep, '');

            if (path.sep !== path.posix.sep) {
              relativeToRuleSource =
                  relativeToRuleSource.split(path.sep).join(path.posix.sep);
            }
            // if i have a current dir of
            // "/a/b/c", a file "file", and rules from directory "/a/b"
            // i need to compare the rules to "c/file"

            // invert the match because matched files should be ignored.
            return !micromatch.any(relativeToRuleSource, ignoreTree[dir]);
          });
        }
        i = dir.lastIndexOf(path.sep);
        dir = dir.substr(0, i);
      }

      return files;
    };

    // TODO: call user provided filter function first if set.
    // let origFilter:(dir:string,files:string[])=>string[]|Promise<string[]>;
    // if(options.filter) origFilter = options.filter;

    options.filter = (dir, files) => {
      // if(origFilter) files = await origFilter(dir,files);
      if (!files.length) return [];

      const unread: Array<Promise<boolean>> = [];
      if (ignoreFiles.length || ignores.length) {
        // check each file name to see if it's an ignore file.
        files.forEach((name) => {
          if (ignoreFilesMap[name]) {
            // read+parse the ignore file, put the rules in the tree, and
            // resolve the promise so we can apply rules.
            unread.push(readIgnore(path.join(dir, name)).then((rules) => {
              if (rules.length) {
                if (!ignoreTree[dir]) {
                  ignoreTree[dir] = rules;
                } else {
                  ignoreTree[dir].push.apply(ignoreTree[dir], rules);
                }
              }
              return true;
            }));
          }
        });
      }

      // walkdir supports mixing sync and async returns
      if (!unread.length) {
        return applyRules(dir, files);
      }

      return Promise.all(unread).then(() => {
        // new ignore files have been read.
        return applyRules(dir, files);
      });
    };
  }
  options.find_links = false;
  return walkdir.async(entryDir, options, onStat);
};


export const readIgnore = (file: string): Promise<string[] >=> {
  return new Promise((resolve, reject) => {
    fs.readFile(file, (err, buf) => {
      if (err) {
        return reject(err);
      }

      const rules = (buf + '').trim().split(/\r\n|\n|\r/).filter((line) => {
        // if its not a comment and more than only whitespace
        if (line.trim().length && line.indexOf('#') !== 0) {
          return true;
        }
        return false;
      });
      resolve(rules);
    });
  });
};
