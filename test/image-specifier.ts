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

import {ImageLocation, parse} from '../src/image-specifier';

const specifiers: Array<{specifier: string, result: ImageLocation}> = [
  {
    specifier: 'ubuntu:lts',
    result: {
      protocol: 'https',
      registry: 'index.docker.io',
      namespace: 'library',
      image: 'ubuntu',
      tag: 'lts',
      digest: undefined
    }
  },
  {
    specifier: 'localhost:5000/ubuntu',
    result: {
      protocol: 'http',
      registry: 'localhost:5000',
      namespace: undefined,
      image: 'ubuntu',
      tag: 'latest',
      digest: undefined
    }
  },
  {
    specifier: 'gcr.io/ryan-gcr-test/smol',
    result: {
      protocol: 'https',
      registry: 'gcr.io',
      namespace: 'ryan-gcr-test',
      image: 'smol',
      tag: 'latest',
      digest: undefined
    }
  },
  {
    specifier: 'docker.io/ubuntu',
    result: {
      protocol: 'https',
      registry: 'index.docker.io',
      namespace: 'library',
      image: 'ubuntu',
      tag: 'latest',
      digest: undefined
    }
  },
  // tests: https://github.com/google/nodejs-container-image-builder/issues/42
  {
    specifier: 'gcr.io/myFirstProject/images/hello-world',
    result: {
      protocol: 'https',
      registry: 'gcr.io',
      namespace: 'myFirstProject/images',
      image: 'hello-world',
      tag: 'latest',
      digest: undefined
    }
  }
];


describe('can parse specifier', () => {
  specifiers.forEach((obj) => {
    it('parses "' + obj.specifier + '"  ', (done) => {
      const result = parse(obj.specifier);
      assert.deepStrictEqual(result, obj.result);
      done();
    });
  });
});
