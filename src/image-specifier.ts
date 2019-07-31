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
import * as url from 'url';

const DEFAULT_REGISTRY_ALIAS = 'docker.io';
/**
 * @fileoverview translate docker registry image specifiers like ubuntu:lts to
 * ImageLocation metadata objects
 */

export const parse = (specifier: string): ImageLocation => {
  const parts = specifier.split('/');

  const match = /([^/]+\/)?(.+\/)?([^/]+)?$/;
  let matches = specifier.match(match);

  if (!matches) {
    throw new Error('invalid image specifier: ' + specifier);
  }
  // discard  the everything match
  matches.shift();
  matches = matches.filter((v) => v);

  const trimSlashes = /^\/|\/$/g;

  let image: string = matches[matches.length - 1];
  if (image) image = image.replace(trimSlashes, '');

  let namespace: string|undefined = matches[matches.length - 2];
  if (namespace) namespace = namespace.replace(trimSlashes, '');

  let registry: string|undefined = matches[matches.length - 3];
  if (registry) registry = registry.replace(trimSlashes, '');

  if (!registry) {
    registry = namespace;
    namespace = undefined;
  }

  if (registry === DEFAULT_REGISTRY_ALIAS || !registry) {
    namespace = 'library';
    registry = 'index.docker.io';
  }

  if (registry.indexOf('docker.io') > -1 && !namespace) {
    namespace = 'library';
  }


  const imageProps: {[k: string]: string} = {};

  ['@', ':'].forEach((c) => {
    if (image.indexOf(c) > -1) {
      const imageParts = image.split(c);
      imageProps[c] = imageParts.pop() || '';
      // ignores multiple @s and tags :shrug:
      image = imageParts.join(c);
    }
  });

  const digest = imageProps['@'];
  const tag = imageProps[':'] || 'latest';


  const protocol = boldlyAssumeProtocol(registry);

  return {protocol, registry, namespace, image, tag, digest};
};

function boldlyAssumeProtocol(registry: string) {
  // from
  // https://github.com/google/go-containerregistry/blob/efb7e1b888e142e2c66af20fd44e76a939b2cc3e/pkg/name/registry.go#L28
  // match a.local:0000
  if (/.*\.local(?:host)?(?::\d{1,5})?$/.test(registry)) return 'http';
  // Detect the loopback IP (127.0.0.1)
  if (registry.indexOf('localhost:') > -1) return 'http';
  if (registry.indexOf('127.0.0.1') > -1) return 'http';
  if (registry.indexOf('::1') > -1) return 'http';

  return 'https';
}

/// these ImageLocation objects for the base of how all
export interface ImageLocation {
  protocol: string;
  registry: string;
  namespace?: string;
  image?: string;
  tag?: string;
  digest?: string;
}