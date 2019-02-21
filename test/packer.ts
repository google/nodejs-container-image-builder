import * as assert from 'assert';
import * as path from 'path';
import {Readable} from 'stream';

import {pack} from '../src/packer';

describe('can pack', () => {
  it('packs a directory', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({[fixtureDir]: '/apples'});

    let paths: string[] = [];

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          [
            'apples/.ignore', 'apples/index.js', 'apples/lib/',
            'apples/lib/a-file.js', 'apples/test/', 'apples/test/taco.yaml',
            'apples/test/test.js'
          ],
          paths, 'should have tarred exactly the specified entries');

      console.log(paths);
      done();
    });
  });

  it('packs a directory honoring an ignore file', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({[fixtureDir]: '/apples'}, {ignoreFiles: ['.ignore']});

    let paths: string[] = [];

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          [
            'apples/.ignore', 'apples/index.js', 'apples/lib/',
            'apples/lib/a-file.js', 'apples/test/', 'apples/test/test.js'
          ],
          paths, 'ignored files in globs in ignore files');

      console.log(paths);
      done();
    });
  });


  it('packs a directory honoring an ignore string', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({[fixtureDir]: '/apples'}, {ignores: ['**/test']});

    let paths: string[] = [];

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          [
            'apples/.ignore', 'apples/index.js', 'apples/lib/',
            'apples/lib/a-file.js'
          ],
          paths, 'ignored test files with **/test glob');

      console.log(paths);
      done();
    });
  });
});
