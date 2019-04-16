import * as assert from 'assert';
import * as path from 'path';
import {PassThrough, Readable, Transform} from 'stream';

import {CustomFile, pack} from '../src/packer';

describe('can pack', () => {
  it('packs a directory', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({'/apples': fixtureDir});

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

    const tar = pack({'/apples': fixtureDir}, {ignoreFiles: ['.ignore']});

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

    const tar = pack({'/apples': fixtureDir}, {ignores: ['**/test']});

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

  it('packs multiple directories', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');
    const otherFixtureDir =
        path.join(__dirname, '..', '..', 'fixtures', 'outside-of-project');

    const tar = pack({'/apples': fixtureDir, '/oranges': otherFixtureDir});

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
            'apples/test/test.js', 'oranges/a-file.js'
          ],
          paths, 'should have tarred exactly the specified entries');

      console.log(paths);
      done();
    });
  });


  it('packs a single file', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({'/apples/index.js': path.join(fixtureDir, 'index.js')});

    let paths: string[] = [];

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          ['apples/index.js'], paths, 'ignored test files with **/test glob');

      console.log(paths);
      done();
    });
  });


  it('packs a single file and directory', (done) => {
    const nodeTar = require('tar');

    const otherFixtureDir =
        path.join(__dirname, '..', '..', 'fixtures', 'outside-of-project');
    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const tar = pack({
      '/apples': otherFixtureDir,
      '/apples/index.js': path.join(fixtureDir, 'index.js')
    });

    let paths: string[] = [];

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          ['apples/a-file.js', 'apples/index.js'], paths,
          'packed directory and single file');

      // console.log(paths);
      done();
    });
  });

  it('errors when asked to pack a file that doesnt exist', (done) => {
    const nodeTar = require('tar');
    const tar = pack({'/apples': 'doesntexist'});

    tar.on('error', (err: Error) => {
      assert.ok(
          err,
          'should have gotten error packing source file that doesn\'t exist.');
      done();
    });

    tar.on('end', () => {
      assert.fail('SHOULD HAVE ERRORED');
      done();
    });
  });


  // TODO packs directory that doesnt exist
});
