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
import {handler} from '../src/auth/dockerio';
import {parse} from '../src/image-specifier';

describe('can authenticate to docker.io', () => {
  it('can get read write token to dockerio', async () => {
    const imageLocation = parse('node:lts');
    const res = await handler(imageLocation, 'push,pull');
    // console.log(res);
    assert.ok(res.token, 'should have token returned from docker api');
  });
});