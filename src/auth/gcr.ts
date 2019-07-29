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
import {GoogleAuth, GoogleAuthOptions} from 'google-auth-library';
import * as request from 'request';

import {DockerAuthResult} from '../credentials-helper';
import {ImageLocation} from '../image-specifier';

export type GCRAuthOptions = {
  token?: string,
  keyFilename?: string,
  credentials?: {private_key: string, client_email: string}
};

// i dont know what the options will be yet
// tslint:disable-next-line:no-any
export const handler = async(
    image: ImageLocation, scope: string,
    options: GCRAuthOptions): Promise<DockerAuthResult> => {
  // google auth options:
  // https://github.com/googleapis/google-auth-library-nodejs/blob/master/src/auth/googleauth.ts#L58

  // client is configured with a valid token from auth.getToken() already. trust
  // it works.
  if (options.token) {
    return {Username: '_token', Secret: options.token, token: options.token};
  }

  // expects GOOGLE_APPLICATION_CREDENTIALS env or options
  const resolvedOptions: GoogleAuthOptions = {
    credentials: options.credentials,
    keyFilename: options.keyFilename
  };
  if (!('scopes' in resolvedOptions)) {
    // Depending on `scope` that describes push and/or pull
    // capabilities, the Google services scope need to be specified to
    // authenticate for reading or reading and writing to the Google
    // Container Registry.
    //
    // Note: `scope` is either `pull` or `pull,push` and specifies
    // reading or reading and writing to a registry respectively.
    resolvedOptions.scopes = scope.indexOf('push') > -1 ?
        'https://www.googleapis.com/auth/devstorage.read_write' :
        'https://www.googleapis.com/auth/devstorage.read_only';
  }

  const auth = new GoogleAuth(resolvedOptions);
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token || undefined;

  // NOTE: even though we have a valid authentication token we fetch a GCR
  // specific token here. We could use the standard google access token but GCR
  // requires this call to lazily initialize your registry for the first time.
  // If we skip this attempts to put the very first blob into the registry will
  // fail.
  const authUrl = `https://${image.registry}/v2/token?service=gcr.io&scope=${
      encodeURIComponent(
          `repository:${image.namespace}/${image.image}:push,pull`)}`;

  return await new Promise((resolve, reject) => {
    request.get(
        {url: authUrl, headers: {Authorization: 'Bearer ' + token}},
        (err, res, body) => {
          if (err || res.statusCode !== 200) {
            reject(
                err ||
                new Error(
                    'unexpected statusCode ' + authUrl + ' ' + res.statusCode +
                    ' from gcr token request'));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
  });
  // return {Username: '_token', Secret: token, token};
};