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
//
import * as request from 'request';

import {DockerAuthResult} from '../credentials-helper';
import {ImageLocation} from '../image-specifier';

// tslint:disable-next-line:no-any
export const handler = (image: ImageLocation, scope: string, options?: any):
    Promise<DockerAuthResult> => {
      // request
      const headers: {[k: string]: string} = {};
      if (options) {
        if (options.Secret && options.Username) {
          headers['Authorization'] = 'Basic ' +
              Buffer.from(options.Username + ':' + options.Secret)
                  .toString('base64');
        } else if (options.token) {
          headers['Authorization'] = 'Bearer ' + options.token;
        }
      }
      return new Promise((resolve, reject) => {
        request(
            {
              method: 'GET',
              url:
                  'https://auth.docker.io/token?service=registry.docker.io&scope=repository:' +
                  (image.namespace ? image.namespace + '/' : '') + image.image +
                  ':' + scope,
              headers
            },
            (err, res, body) => {
              if (err) return reject(err);
              if (res.statusCode !== 200) {
                return reject(new Error(
                    'unexpected status code ' + res.statusCode +
                    ' authenticating with docker.io'));
              }

              try {
                resolve(JSON.parse(body + '') as {token: string});
              } catch (e) {
                reject(e);
              }
            });
      });
    };