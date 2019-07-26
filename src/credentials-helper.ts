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

import * as spawn from 'cross-spawn';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';


// i would use home-path here but im not sure if the docker cli config file even
// exists in the user home dir in windows.
const defaultPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '', '.docker',
    'config.json');

export class DockerCredentialHelpers {
  private dockerConfig: DockerCredsConfig = {};

  constructor(customPathOrConfig?: string|DockerCredsConfig) {
    if (typeof customPathOrConfig === 'string' || !customPathOrConfig) {
      this.readDockerConfig(customPathOrConfig);
    } else {
      this.dockerConfig = customPathOrConfig || {};
    }
  }

  auth(registry: string): Promise<DockerAuthResult> {
    const host = url.parse(registry).host || registry;
    // console.log('authing to registry ' + registry, ' with host ', host);
    return new Promise((resolve, reject) => {
      if (!this.dockerConfig.credHelpers ||
          !this.dockerConfig.credHelpers[host]) {
        reject(new Error('no auth handler for ' + host));
      }
      const helper =
          'docker-credential-' + this.dockerConfig.credHelpers![host];

      let endCount = 0;
      const bufs: Buffer[] = [];
      const ebufs: Buffer[] = [];

      let maybeEnd = (err?: Error) => {
        if (err) {
          maybeEnd = () => {};
          return reject(err);
        }

        endCount++;
        if (endCount === 2) {
          resolve((json(Buffer.concat(bufs)) || {}) as DockerAuthResult);
        }
      };
      const proc = spawn(helper, ['get']);
      proc.on('exit', (code) => {
        if (code) {
          return reject(new Error(
              'exit code ' + code + ' from docker credential helper ' + helper +
              '\nstderr: ' + Buffer.concat(ebufs) + ''));
        }
        maybeEnd();
      });

      proc.stdout.on('data', (b) => bufs.push(b))
          .on('end', maybeEnd)
          .on('error', maybeEnd);

      proc.stderr.on('data', (b) => ebufs.push(b)).on('error', maybeEnd);
      proc.stdin.end(host);
    });
  }

  readDockerConfig(customPath?: string) {
    try {
      this.dockerConfig =
          (JSON.parse(
               fs.readFileSync(
                   customPath ||
                   (process.env.DOCKER_CONFIG ?
                        path.join(process.env.DOCKER_CONFIG, 'config.json') :
                        false) ||
                   defaultPath) +
               '') ||
           {}) as DockerCredsConfig;
    } catch (e) {
    }
    return this.dockerConfig;
  }

  getDockerConfig() {
    return this.dockerConfig;
  }

  setDockerConfig(config: DockerCredsConfig) {
    this.dockerConfig = config || {};
  }
}

function json(s: string|Buffer) {
  try {
    return JSON.parse(s + '');
  } catch (e) {
  }
}

export type DockerAuthResult = {
  Username?: string,
  Secret?: string,
  token?: string
};

export type DockerCredsConfig = {
  credHelpers?: {[registryUrl: string]: string}
};