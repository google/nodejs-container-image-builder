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
import * as crypto from 'crypto';
import * as retry from 'p-retry';
import * as path from 'path';
import * as zlib from 'zlib';

import {handler as dockerAuth} from './auth/dockerio';
import {handler as gcrAuth} from './auth/gcr';
import {DockerCredentialHelpers} from './credentials-helper';
import {ImageLocation, parse as parseSpecifier} from './image-specifier';
import * as packer from './packer';
import {pending, PendingTracker} from './pending';
import {ImageConfig, ManifestV2, RegistryClient} from './registry';

const tar = require('tar');

// expose plain registry client.
export {RegistryClient} from './registry';

export type ImageOptions = {
  auth?: AuthConfig,
  sync?: false|undefined
};
export type ImageData = {
  manifest: ManifestV2,
  config: ImageConfig
};


export class Image {
  private options: ImageOptions;
  private image: ImageLocation;
  // where to save the image and where to upload blobs
  private targetImage: ImageLocation;
  // the manifest and config for the source image
  private imageData: Promise<ImageData>;
  private originalManifest?: ManifestV2;
  private clients: {[k: string]: RegistryClient|Promise<RegistryClient>} = {};

  private pending: PendingTracker;

  private syncedBaseImage = false;

  // convenience properties. these values get updated in the image config when
  // saving. these overwrite values updated manually in ImageData.config.config
  // tslint:disable-next-line:variable-name
  WorkingDir?: string;
  // tslint:disable-next-line:variable-name
  Cmd?: string[];
  // tslint:disable-next-line:variable-name
  Env?: string[];

  // queue all pending actions so i can Promise.all them in save before saving
  // manifest

  constructor(
      imageSpecifier: string, targetImage?: string, options?: ImageOptions) {
    this.options = options || {};
    this.image = parseSpecifier(imageSpecifier);
    this.targetImage = parseSpecifier(targetImage || imageSpecifier);

    this.pending = pending();

    // setup default client.
    // if the to and from match host and namespace we'll make one write client.
    const readOnly =
        this.authKey(this.image) !== this.authKey(this.targetImage);

    this.client(this.image, !readOnly);
    this.imageData = this.getImageData();
  }

  // returns the part of the config object you care about for things like
  // entrypoint and env.
  async getImageConfig() {
    const imageData = await this.getImageData();
    return imageData.config.config;
  }

  async addLayer(
      digest: string, uncompressedDigest: string, size: number,
      urls?: string[]) {
    const imageData = await this.getImageData();
    let layerMediaType = 'application/vnd.oci.image.layer.v1.tar+gzip';
    if (imageData.manifest.mediaType.indexOf('docker') > -1) {
      layerMediaType = 'application/vnd.docker.image.rootfs.diff.tar.gzip';
    }

    const layerResult = {mediaType: layerMediaType, digest, size, urls};

    imageData.manifest.layers.push(layerResult);
    imageData.config.rootfs.diff_ids.push(uncompressedDigest);

    return Object.assign({}, layerResult, {uncompressedDigest});
  }

  async removeLayer(digest: string) {
    // edit the config and manifest returned from getImageData
    const imageData = await this.getImageData();
    const layers = imageData.manifest.layers;
    let found: number|undefined;
    layers.forEach((layerData, i) => {
      if (layerData.digest === digest) {
        found = i;
      }
    });
    if (found !== undefined) {
      layers.splice(found, 1);
      imageData.config.rootfs.diff_ids.splice(found, 1);
      return true;
    }
    return false;
  }
  // "./myfiles", "/workspace"
  // "localDirectory", "imageDirectory"
  addFiles(
      dir: string|{[dir: string]: string},
      targetDir?: string|packer.PackOptions,
      options?: packer.PackOptions): Promise<{
    mediaType: string,
    digest: string,
    size: number,
    uncompressedDigest: string
  }> {
    // dir,target,options
    // dir,options
    // {dir:target,....},options
    if (typeof targetDir === 'string') {
      if (typeof dir !== 'string') {
        // addFiles({"apples":"oranges"},"pears")
        throw new Error(
            'specifying a target directory name when the dir is an object of name:target doesn\'t make sense. try addFiles({dir:target})');
      }
      dir = {[dir]: targetDir};
    } else if (targetDir) {
      // options!
      options = targetDir;
    }

    // have to wrap in promise because the tar stream can emit error out of band
    const p = new Promise(async (resolve, reject) => {
      const tarStream = packer.pack(dir, options);

      tarStream.on('error', (e: Error) => reject(e));

      const gzip = zlib.createGzip();

      const uncompressedHash = crypto.createHash('sha256');

      tarStream.on('data', (buf: Buffer) => {
        uncompressedHash.update(buf);
      });

      tarStream.pipe(gzip);

      const client = await this.client(this.targetImage);
      const result = await client.upload(gzip);

      const uncompressedDigest = 'sha256:' + uncompressedHash.digest('hex');

      resolve(await this.addLayer(
          result.digest, uncompressedDigest, result.contentLength));
    });

    this.pending.track(p);

    return p as Promise<{
             mediaType: string; digest: string; size: number;
             urls: string[] | undefined;
             uncompressedDigest: string;
           }>;
  }

  async getImageData() {
    if (!this.imageData) {
      this.imageData = this.loadImageData();
      this.pending.track(this.imageData);
      this.imageData.then((data) => {
        this.originalManifest = JSON.parse(JSON.stringify(data.manifest));
      });
    }
    return this.imageData;
  }

  async loadImageData(image?: ImageLocation) {
    image = (image ? image : this.image);
    const client = await this.client(image);
    const manifest = await client.manifest(image.tag || 'latest');

    const configBlob = await client.blob(manifest.config.digest) + '';
    const config = JSON.parse(configBlob) as ImageConfig;

    return {manifest, config};
  }

  client(_image?: ImageLocation|string, write?: boolean) {
    let image: ImageLocation;
    if (typeof _image === 'string') {
      image = parseSpecifier(_image);
    } else {
      // typescript!!!
      image = _image as ImageLocation;
    }

    image = (image ? image : this.image);
    const scope = write ? 'push,pull' : 'pull';
    let key = [image.registry, image.namespace, image.image].join(',');

    const writeKey = key + ',push,pull';
    const readKey = key + ',pull';

    // default to most permissive cached client even if it doesn't match scope.
    if (this.clients[writeKey]) {
      return this.clients[writeKey];
    } else if (!write && this.clients[readKey]) {
      return this.clients[readKey];
    }

    key += ',' + scope;
    const promiseOfClient =
        auth(image, scope, this.options.auth || {}).then((registryAuth) => {
          const registryClient = new RegistryClient(
              image!.registry, this.nameSpacedImageName(image), registryAuth);
          return registryClient;
        });

    this.clients[key] = promiseOfClient;
    return promiseOfClient;
  }

  async save(tags?: string[], options?: SyncOptions&{
    Env?: string[],
    Cmd?: string[],
    WorkingDir?: string
  }) {
    tags = tags || ['latest'];

    options = options || {};

    const targetImage = this.targetImage;
    const client = await this.client(targetImage, true);
    const imageData = await this.getImageData();

    await this.syncBaseImage(options);

    await Promise.all(this.pending.active());

    if (options.Cmd || this.Cmd) {
      imageData.config.config.Cmd = options.Cmd || this.Cmd!;
    }

    if (options.Env || this.Env) {
      [].push.apply(imageData.config.config.Env, options.Env || this.Env || []);
    }

    if (options.WorkingDir || this.WorkingDir) {
      imageData.config.config.WorkingDir =
          options.WorkingDir || this.WorkingDir!;
    }

    // are all layers done uploading?
    const uploadResult =
        await client.upload(Buffer.from(JSON.stringify(imageData.config)));
    imageData.manifest.config.digest = uploadResult.digest;
    imageData.manifest.config.size = uploadResult.contentLength;
    // console.log('config upload result.', uploadResult);

    // put the manifest once per tag
    return Promise
        .all(tags.filter((v) => !!v).map((tag) => {
          return client.manifestUpload(
              encodeURIComponent(tag), imageData.manifest);
        }))
        .then((results) => {
          return results[0];
        });
  }

  private authKey(image: ImageLocation) {
    if (image.registry.indexOf('gcr.io')) {
      // should use same auth if in same google cloud project.
      return [image.registry, image.namespace].join(',');
    }
    return [image.registry, image.namespace, image.image].join(',');
  }

  // verify that every layer is in the target and copy missing layers from base
  // to target
  async sync(options?: SyncOptions) {
    options =
        Object.assign({copyRemoteLayers: true, ignoreExists: false}, options);
    // ensure image data has been loaded.
    await this.getImageData();
    // use base manifest for sync
    const manifest = this.originalManifest;
    if (!manifest) {
      throw new Error(
          'get image data failed to populate originalManifest somehow.');
    }
    const client = await this.client(this.image);
    const targetClient = await this.client(this.targetImage);
    // check that every layer in source image is present in target registry
    const copies: Array<Promise<{}>> = [];
    manifest.layers.forEach((layer) => {
      // note: support *not* copying nondistributable layers by default once
      // it's supported by gcr.
      if (!options!.copyRemoteLayers && layer.urls) {
        return;
      }
      const p = targetClient.blobExists(layer.digest).then((exists) => {
        if (!exists || options!.ignoreExists) {
          // TODO if they are the same registry but different namespaces try
          // mount first.
          const action = () => {
            return new Promise(async (resolve, reject) => {
              const stream = await client.blob(layer.digest, true);

              // if the stream ends without the correct byte length
              let bytes = 0;
              stream.on('data', (b) => {
                bytes += b.length;
              });

              stream.on('end', () => {
                if (bytes !== layer.size) {
                  reject(Error(
                      'failed to get all of the bytes from the blob stream.'));
                }
              });

              stream.on('error', (err: Error) => {
                reject(err);
              });
              try {
                resolve(await targetClient.upload(
                    stream, layer.size, layer.digest));
              } catch (e) {
                console.error(
                    'error syncing layer ' + layer.digest +
                    ' to target registry:\n' + e);
                reject(e);
              }
            });
          };
          return retry(action, {retries: 3});
        }
        return true;
      });
      copies.push(p);
    });

    const all = Promise.all(copies);
    this.pending.track(all);
    return all;
  }

  private async syncBaseImage(options?: SyncOptions) {
    const sameRegistry = this.image.registry === this.targetImage.registry;
    const sameProject = this.image.namespace === this.targetImage.namespace;
    if (sameRegistry && sameProject) {
      return;
    }
    if (this.syncedBaseImage) {
      return;
    }
    this.syncedBaseImage = true;
    return this.sync(options);
  }

  private nameSpacedImageName(image?: ImageLocation) {
    image = (image ? image : this.image);
    return (image.namespace ? image.namespace + '/' : '') + image.image;
  }
}


export const auth = async (
    image: ImageLocation|string, scope: string, options?: AuthConfig) => {
  // todo: distinguish better between when we should try creds helpers vs only
  // built in.

  if (typeof image === 'string') {
    image = parseSpecifier(image);
  }

  try {
    if (image.registry.indexOf('gcr.io') > -1) {
      return await gcrAuth(
          image, scope, options ? options['gcr.io'] : undefined);
    } else if (image.registry.indexOf('docker.io') > -1) {
      return await dockerAuth(
          image, scope, options ? options['docker.io'] : undefined);
    }
  } catch (e) {
    // console.error(
    //    'gcr or docker.io auth threw.\n' + e +
    //    '\n falling back to cred helpers.');
  }

  const credHelpers = new DockerCredentialHelpers();
  const res = await credHelpers.auth(image.registry);

  return res;
};


export interface AuthConfig {
  // tslint:disable-next-line:no-any
  [k: string]: any;
}

export interface SyncOptions {
  copyRemoteLayers?: boolean;
  ignoreExists?: boolean;
}
