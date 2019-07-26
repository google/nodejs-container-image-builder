import * as assert from 'assert';
import * as fs from 'fs';
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

    let files = [
      'apples/.ignore', 'apples/index.js', 'apples/lib/',
      'apples/lib/a-file.js', 'apples/test/', 'apples/test/taco.yaml',
      'apples/test/test.js'
    ];
    if (process.platform === 'win32') {
      files = [
        'apples/.ignore', 'apples/index.js', 'apples/lib', 'apples/test/',
        'apples/test/taco.yaml', 'apples/test/test.js'
      ];
    }

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          files, paths, 'should have tarred exactly the specified entries');

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

    let files = [
      'apples/.ignore', 'apples/index.js', 'apples/lib/',
      'apples/lib/a-file.js', 'apples/test/', 'apples/test/test.js'
    ];

    if (process.platform === 'win32') {
      // git clones symlinks on windows to regular test files with their target
      // path in them.
      files = [
        'apples/.ignore', 'apples/index.js', 'apples/lib', 'apples/test/',
        'apples/test/test.js'
      ];
    }


    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          files, paths, 'ignored files in globs in ignore files');

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



    let files = [
      'apples/.ignore', 'apples/index.js', 'apples/lib/', 'apples/lib/a-file.js'
    ];

    if (process.platform === 'win32') {
      // git clones symlinks on windows to regular test files with their target
      // path in them.
      files = ['apples/.ignore', 'apples/index.js', 'apples/lib'];
    }


    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          files, paths, 'ignored test files with **/test glob');

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

    let files = [
      'apples/.ignore', 'apples/index.js', 'apples/lib/',
      'apples/lib/a-file.js', 'apples/test/', 'apples/test/taco.yaml',
      'apples/test/test.js', 'oranges/a-file.js'
    ];
    if (process.platform === 'win32') {
      files = [
        'apples/.ignore', 'apples/index.js', 'apples/lib', 'apples/test/',
        'apples/test/taco.yaml', 'apples/test/test.js', 'oranges/a-file.js'
      ];
    }

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(
          files, paths, 'should have tarred exactly the specified entries');

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

  it('applies backpressure when packing node_modules', (done) => {
    const tar =
        pack({'/apples': path.resolve(__dirname, '..', '..', 'node_modules')});

    // this can bve any number thats less than the number of files in
    // node_modules.
    const TEST_AT_ENTRY = 1000;

    // we set this because if we fail to find the number of entries we expect
    // the test will never run.
    let hitTest = false;


    // todo the test need to make sure we've processed at least TEST_AT_ENTRY
    // entries +1

    const myTransform = new Transform({
      transform(chunk, encoding, callback) {
        if (tar._debug_entries_written === TEST_AT_ENTRY) {
          let lastWritten = tar._debug_entries_written;
          // this roughly defines a pause as no entries to be started in the
          // last 100 ms this is not in fact what a
          waitForCondition(
              (err) => {
                assert.ok(!err, 'should pause within one second.');
                callback(undefined, chunk);
                setTimeout(() => {
                  assert.ok(
                      tar._debug_entries_written > lastWritten,
                      'should process more entries in next 100 ms');
                  hitTest = true;
                }, 100);
              },
              () => {
                const pass = lastWritten === tar._debug_entries_written;
                lastWritten = tar._debug_entries_written;
                return pass;
              },
              1000);

          return;
        }

        callback(undefined, chunk);
      }
    });

    myTransform.on('readable', (bytes: number) => {
      while (myTransform.read()) {
        // discard stream content
      }
    });

    tar.pipe(myTransform).on('end', () => {
      assert.ok(hitTest, 'should have processed at least 1000 entries.');
      console.log('done done.');
      done();
    });
  });

  // TODO packs directory that doesnt exist
});

function waitForCondition(
    done: (err?: Error) => void, check: () => boolean, timeout: number) {
  const checks = 10;
  const t = timeout / checks;
  let attempts = 0;
  const poll = () => {
    setTimeout(() => {
      attempts++;
      const passed = check();
      if (passed) {
        return done();
      }
      if (attempts >= checks) {
        return done(new Error('failed after ' + checks + ' attempts'));
      }
      poll();
    }, t);
  };
  poll();
}