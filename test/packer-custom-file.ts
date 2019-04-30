import * as assert from 'assert';
import * as path from 'path';
import {PassThrough, Readable} from 'stream';

import {CustomFile, pack} from '../src/packer';

describe('packer customFiles', () => {
  it('packs a custom file', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    /*
    packer: entry header Header {
  cksumValid: false,
  needPax: false,
  nullBlock: false,
  block: null,
  path: '/a-file',
  mode: 420,
  uid: null,
  gid: null,
  size: 8,
  mtime: 2019-03-27T23:20:06.287Z,
  cksum: null,
  linkpath: null,
  uname: null,
  gname: null,
  devmaj: 0,
  devmin: 0,
  atime: null,
  ctime: null,
  [Symbol(type)]: '0' }
    */

    const tar =
        pack({'/a-file': new CustomFile({data: Buffer.from('content')})});

    let paths: string[] = [];
    const data: {[k: string]: Buffer[]} = {};
    const bufs: Buffer[] = [];

    const extract = tar.pipe(new nodeTar.Parse());

    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      data[e.path] = [];
      e.on('data', (buf) => {
        data[e.path].push(buf);
      });
    });

    extract.on('end', () => {
      paths = paths.sort();


      assert.deepStrictEqual(['a-file'], paths, 'found custom file');

      assert.strictEqual(
          Buffer.concat(data['a-file']) + '', 'content',
          'should be able to extract content from custom files.');

      done();
    });
  });

  it('packs an empty custom file', (done) => {
    const nodeTar = require('tar');


    const tar = pack({'/a-file': new CustomFile({size: 0})});

    let paths: string[] = [];
    const data: {[k: string]: Buffer[]} = {};

    const extract = tar.pipe(new nodeTar.Parse());

    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      data[e.path] = [];
      e.on('data', (buf) => {
        data[e.path].push(buf);
      });
    });

    extract.on('end', () => {
      paths = paths.sort();

      assert.deepStrictEqual(['a-file'], paths, 'found custom file');

      assert.strictEqual(
          Buffer.concat(data['a-file']) + '', '',
          'should get no data for the file.');

      done();
    });
  });

  it('packs a custom link', (done) => {
    const nodeTar = require('tar');

    const tar = pack({
      '/a-file': new CustomFile(
          {type: 'SymbolicLink', linkPath: '/linktarget', size: 0})
    });

    let paths: string[] = [];
    const links: string[] = [];
    // const data: {[k: string]: Buffer[]} = {};
    // const bufs: Buffer[] = [];

    const extract = tar.pipe(new nodeTar.Parse());

    extract.on('entry', (e: Readable&{path: string, linkpath: string}) => {
      paths.push(e.path);
      links.push(e.linkpath);
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(['a-file'], paths, 'found custom link');
      assert.deepStrictEqual(['/linktarget'], links, 'found custom link');
      done();
    });
  });

  it('packs a custom file from stream', (done) => {
    const nodeTar = require('tar');

    const fixtureDir = path.join(__dirname, '..', '..', 'fixtures', 'project');

    const s = new PassThrough();

    const tar = pack({'/b-file': new CustomFile({data: s, size: 4})});
    s.end(Buffer.from('bork'));

    let paths: string[] = [];

    const data: {[k: string]: Buffer[]} = {};

    const extract = tar.pipe(nodeTar.t());
    extract.on('entry', (e: Readable&{path: string}) => {
      paths.push(e.path);
      data[e.path] = [];
      e.on('data', (buf) => {
        data[e.path].push(buf);
      });
      e.resume();
    });

    extract.on('end', () => {
      paths = paths.sort();
      assert.deepStrictEqual(['b-file'], paths, 'found custom file');

      assert.strictEqual(
          Buffer.concat(data['b-file']) + '', 'bork',
          'should be able to extract content from custom files.');

      done();
    });
  });
});