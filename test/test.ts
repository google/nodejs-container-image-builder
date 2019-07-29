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

import * as assert from 'assert';
import * as cp from 'child_process';
import {withFixtures} from 'inline-fixtures';
import * as path from 'path';

import {Image} from '../src/index';

process.on('unhandledRejection', (err) => {
  throw new Error('un handled rejection' + err + err.stack);
});

describe('makes image object', () => {
  it('can load image data', async () => {
    const image = new Image('node:lts-slim');
    const data = await image.getImageData();

    assert.strictEqual(
        data.manifest.mediaType,
        'application/vnd.docker.distribution.manifest.v2+json',
        'should have media type in manifest');
    assert.ok(data.config.rootfs, 'should have rootfs in config.');
  });


  it('can catch error from loading image data', async () => {
    const errstring = 'getting manifest is broken';
    const image = new Image('node:lts-slim');
    const client = await image.client();
    client.manifest = () => {
      throw new Error(errstring);
    };

    try {
      await image.getImageData();
    } catch (e) {
      assert.ok(e.message.indexOf(errstring) > -1, 'should have caught error');
      return;
    }
    assert.fail('should have thrown from getImage data');
  });


  it('downloads all of blob stream', (done) => {
    (async () => {
      const digest =
          'sha256:0aef02c806f1a8d27d2a2f507ffc86e1025594404f3a5058c5a7dbc61b58af64';
      const image = new Image('node:lts-slim');
      const client = await image.client();
      const out = await client.blob(digest, true);
      const bufs: Buffer[] = [];
      out.on('data', (b: Buffer) => {
        bufs.push(b);
      });

      out.on('end', () => {
        const all = Buffer.concat(bufs);
        const crypto = require('crypto');
        const resultDigest =
            crypto.createHash('sha256').update(all).digest('hex');

        assert.strictEqual(
            'sha256:' + resultDigest, digest,
            'digest must match expected digest');
        done();
      });
      out.resume();
    })();
  });

  it('can save', async () => {
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCR_PROJECT;
    if (!project) {
      console.log(
          'SKIPPING GOOGLE CONTAINER REGISTRY INTEGRATION TESTS BECAUSE NO GOOGLE_CLOUD_PROJECT ENVIRONMENT VARIABLE SET.');
      return;
      // throw new Error('GOOGLE_CLOUD_PROJECT environment variable required.');
    }
    const ID = Date.now();
    const targetImage = 'gcr.io/' + (project) + '/integration-' + ID;



    const image = new Image('node:lts-slim', targetImage);
    const data = await image.getImageData();

    assert.strictEqual(
        data.manifest.mediaType,
        'application/vnd.docker.distribution.manifest.v2+json',
        'should have media type in manifest');
    assert.ok(data.config.rootfs, 'should have rootfs in config.');

    const fixtureProject =
        path.resolve(__dirname, '..', '..', 'fixtures/project');

    const result = image.addFiles(fixtureProject, '/code');

    const saveResult = await image.save(['joltik', 'pikachu'], {
      Cmd: ['node', 'index.js'],
      WorkingDir: '/code',
      Env: ['TACO=' + ID],
      // ignoreExists: true
    });

    const FIXTURES = {
      'config.json': `{
        "credHelpers":{
          "gcr.io":"integration-test"
        }
      }`,
      'docker-credential-integration-test': {
        content: `#!/usr/bin/env node
        process.env.GOOGLE_APPLICATION_CREDENTIALS = ${
            JSON.stringify(process.env.GOOGLE_APPLICATION_CREDENTIALS)};
        const {GoogleAuth} = require("${
            require.resolve('google-auth-library')}");
        const main = async ()=>{
          const auth = new GoogleAuth({scopes:"https://www.googleapis.com/auth/devstorage.read_write"})
          const client = await auth.getClient();
          const token = (await client.getAccessToken()).token || undefined;
          process.stdout.write(JSON.stringify({Secret:token,username:'_dcgcloud_token'}))
        }
        main();
        `,
        mode: 0o777
      }
    };

    await withFixtures(FIXTURES, async (fixturesDir) => {
      console.log('CREATED: ', targetImage);
      console.log('trying image in docker. have fixtures dir ' + fixturesDir);
      /*
      const res = cp.spawnSync(
          path.join(fixturesDir, 'docker-credential-integration-test'));
      res.output[1] += '';
      res.output[2] += '';
      console.log('trying cred helper: ', res);
      */
      const dockerResult =
          cp.execSync('docker run ' + targetImage + ':pikachu', {
            env: Object.assign({}, process.env, {
              DOCKER_CONFIG: fixturesDir,
              PATH: fixturesDir + ':' + process.env.PATH
            })
          });

      const parsed = JSON.parse(dockerResult + '');

      assert.strictEqual(
          +parsed.env.TACO, ID,
          'should have built a container with the correct cmd and ENV data');
    });
  });
});