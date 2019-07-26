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

import * as walker from '../src/walker';

const fixturePath = path.resolve(__dirname, '..', '..', 'fixtures', 'project');

describe(__filename + '', () => {
  it('walks', async () => {
    let result = await walker.walk(fixturePath, {
      return_object: false,
      find_links: false,
      ignoreFiles: ['.ignore']
    }) as string[];
    result = result.map((path) => path.replace(fixturePath, ''));

    assert.ok(
        result.indexOf('/taco.yaml') === -1,
        'should have honored ignore file and removed taco.yaml');
  });


  it('ignores', async () => {
    let result =
        await walker.walk(
            fixturePath,
            {return_object: false, find_links: false, ignores: ['**/test']}) as
        string[];
    result = result.map((path) => path.replace(fixturePath, ''));


    /*
    [ '/.ignore',
    '/index.js',
    '/test',
    '/lib',
    '/test/taco.yaml',
    '/test/test.js',
    '/lib/a-file.js' ]
    */

    console.log(result);

    assert.ok(
        result.indexOf('/test/test.js') === -1,
        'should have honored ignore string and removed test files');
  });
});