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
import * as path from 'path';

import {DockerCredentialHelpers} from '../src/credentials-helper';

describe('can get token from credential helper.', () => {
  it('can exec cred helper', async () => {
    const fixtureDir =
        path.resolve(path.join(__dirname, '..', '..', 'fixtures'));
    const helper =
        new DockerCredentialHelpers(path.join(fixtureDir, 'docker.json'));

    process.env.PATH += path.delimiter + fixtureDir;

    const config = helper.getDockerConfig();

    assert.ok(config && config.credHelpers!['gcr.io'], 'should have handler');

    const result = await helper.auth('https://gcr.io/');

    assert.strictEqual(
        result.Username, '_bork', 'should have returned username');
    assert.strictEqual(
        result.Secret, 'gcr.io',
        'should have passed correct registry host to helper');
  });
});