container-image-builder
=======================

A container registry client and image builder with no dependency on docker. This supports protocol version 2.

This library has a few parts:

- An `Image` class: takes care of authentication, creating new registry clients, and packaging up local files. 
- Registry clients: perform exactly the api calls defined in the [oci spec.](https://github.com/opencontainers/distribution-spec/blob/master/spec.md)

You can do most things with the `Image` class. It takes care of tedious tasks like copying layers missing from one registry into another so you can save your new image.

## Example

Create a new image based off of the official node image with your files in it.

```js
import {Image} from 'container-image-builder'

;(async()=>{
const image = new Image('node:lts-slim','gcr.io/my-project/my-image')

// add local files to the image.
await image.addFiles({"./":'/directory-root-for-files-in-container'})

// creates a layer in the image with files like
// /directory-root-for-files-in-container/[the files in ./]

// set the default working directory for commands
image.WorkingDir = "/directory-root-for-files-in-container"
// set the default command to run in the container
image.Cmd = ["node","index.js"]
// append environment variables.
image.Env = []

// save the new image at latest
const result = await image.save()

console.log(result)
})();
```

You can run the image using docker, or deploy it to a docker host:

```sh
docker run gcr.io/my-project/my-image:latest

```

## Install

```
npm install container-image-builder
```

### Glossary

Learning about this distribution api I struggled mapping the names of some of the things to things I was familiar with.

Defined in the order that they compose into an "Image":

- digest
    - sha256 sum encoded as hex prefixed with "sha256:".

- blob
    - any file stored in a docker registry. 
    - B=but they are mostly 2 kinds. "config" json or "layer" tarball.

- layer
    - is a tarball.
    - these tarballs are expanded at the root of the file system when run as part of an image as a container.

- config
    - a json document stored as a blob and referenced in the manifest.
    - this hold details about the environment and what commands should be run when your image run as a container.
    - this holds an array of the shasums of every layer in a property called diff_ids. I call this `uncompressedDigest` throughout this client.
    - I call it an uncompressedDigest because its the shasum of the layer before it's gzipped.
    - because we need the uncompressed digest for every layer quite a few things in this api are less straight forward that you might expect.

- manifest
    - a json document that stores information about all of the layers in the image, and the digest of the config.
    - each layer is a reference to a blob by digest along with contentLength and other optional properties. 
    - a manifest can have a tag which is a convenient way to name a specific version of the image.

- Image
    - is a combination of N layer blobs.
    - one image config blob.
    - and the manifest.

- Container
    - a process running an Image.
    - docker and other container runners make images useful.

## API

- `const {Image} = require('container-image-builder')`
- or `import {Image} from 'container-image-builder'` in typescript etc.

### Image builder API

- `image = new Image(baseImage:string,targetImage:string)`
    - baseImage
        the name of the base image. these are image specifiers just like you would pass to other container tools.
    - targetImage
        the name of the image you're going to be saving to. calls to image.save() will replace this image.

- `image.addFiles({[targetDirectory]:localDirectory},options): Promise<..>`
    - _BREAKING CHANGE_ between 1x AND 2x
        - positions of `targetDirectory` and `localDirectory` were flipped in the object.
        - when paths are specified as an object the keys are now `targetDirectory`. 
        - this enables copying the same files into a container to different paths and CustomFiles

    - tar local directories and place each at targetDirectory in a single layer.
    - symlinks are replaced with their files/directories as they are written to the layer tarball by default.
    - options
        - `options.ignores`
            - optional set of globs applied at the root of the local directory processed by [micromatch](https://www.npmjs.com/package/micromatch).
        - `options.ignoreFiles`
            - optional array of file names to be parsed for ignore globs. like `[".ignore"]`.
        - `options.tar` 
            - control how the tar is packed with options from [node tar](https://www.npmjs.com/package/tar#class-tarpack).
        - control directory traversal with options from [walkdir](https://www.npmjs.com/package/walkdir).
        
    - you can also call it with arguments like this but you should probably use the default.
        - `image.addFiles(localDirectory,targetDirectory,options) :Promise<..>`
        - `image.addFiles(localDirectory,options) :Promise<..>`

- `image.save(tags?: string[], options)`
    - save changes to the image. by default this saves the updated image as the `latest` tag
    - `tags`, `string[]`
        - if you specify tags the manifest will be taged with each of them instead of the default.
    - `options`
        - Cmd. see image.Cmd below
        - Env. see image.Env below
        - WorkingDir. see image.WorkingDir below
        - copyRemoteLayers, default true
            - set to false if you use nondistributable layers and cannot copy them to the target registry.
            - layers with a urls field will be copied into the target registry by default from the first url to return a 200 in the array.
        - ignoreExists, default false.
            - primarily for debug/testing. this copies a blob into the target registry even though it already exists in the target

- `image.WorkingDir = "/custom working dir"`
    - `string` 
    - If set this set the container's default working directory for commands.

- `image.Cmd = ["ls","./"]` 
    - `string[]`
    - If set this will replace the base images default command with the one you specify.

- `image.Env = ["HOME=/workspace"]`
    - `string[]`
    - append environment variables to the base image's env vars.

- `image.getImageConfig() Promise<{ImageConfig}>`
    - returns reference to the part of the image config you're most likely to want to change.
    - changes to this object are saved when you call `image.save()`

- `image.getImageData() Promise<{manifest:ImageManifest,config:ImageConfig}>`
    - returns internal copies of the image manifest and config
    - you need this if you are doing fancy things like replacing a specific layer
    - _warning_ its easy to make changes here that will create an image that does not work.
    - changes to these objects will be saved when you call `image.save()`

- `image.client(imageSpecifier,writePermission) Promise<RegistryClient>`
    - args are optional. uses a cached client if one already exists.
    - return a promise to an authenticated registry client. 
        - auth is performed with options passed to new Image.
    - imageSpecifier, `string`
        - just like you would pass to docker or the image constructor.
    - default is the base image used in the constructor

- `image.sync(options)`
    - options. optional
    - copyRemoteLayers, default true
        - set to false if you use nondistributable layers and cannot copy them to the target registry.
        - layers with a urls field will be copied into the target registry by default from the first url to return a 200 in the array.
    - ignoreExists, default false.
        - primarily for debug/testing. this copies a blob into the target registry even though it already exists in the target.
    - manually trigger a sync from base image to target image registry.
    - this copies blobs from one registry to another. you may want to use this for performance to start copying base image layers while you do other work.
    - if the image has been synced it will not be synced in the call to `image.save()`

- `image.addLayer(digest: string, uncompressedDigest: string, size: number,urls?: string[])`
    - digest _required_
        - this is the id for the layer in the manifest
    - uncompressedDigest  _required_
        - this is the id for the layer in the diff_ids array from the image config that maps to the layer.
    - size _required_
        - the number of bytes of the compressed layer tarball.
    - urls, optional
        - string[] of urls where we can download this layer tarball. used mostly for nondistributable layers.

- `image.removeLayer(digest:string)`
    - digest, string _required_
        - the sha256 sum of the compressed layer tarball from a manifest.

    - remove the layer tagged in the manifest by digest. save it's offset in the array.
    - remove the uncompressedDigest from the image config that matches the offset above

### docker registry auth

`const {auth} = require('container-image-builder')`

Authenticate to docker registries. This library has built in support for [Google Container Registery](https://cloud.google.com/container-registry/) (`gcr.io`) and [docker hub](https://hub.docker.com/).
for all other cases it'll fall back to using docker credential helpers already installed on your system.

- `auth(imageSpecifier,scope,options) Promise<{Secret?:string,Username?:string,token?:string}>`
    - imageSpecifier, string
        - image location like you pass to docker.
    - scope, string "push" or "push,pull"
        - passed to the auth api if requesting docker hub or `gcr.io`.
    - options
        - options['gcr.io'] = {...}
            - these are auth options passed directly to [google-auth-library](https://www.npmjs.com/package/google-auth-library).
            - you can also set the environment variable `GOOGLE_APPLICATION_CREDENTIALS=path to key file.json` and it will work as expected like other google client libraries.
        - options['docker.io'] = {...}
            - accepts these options. all are strings.
            - either `token` is required or `Username`,`Secret` is required. we'll either try Basic or Bearer auth depending on credentials provided.
            - `options.Secret`
            - `options.Username`
            - `options.token`

### registry client API

As you get more creative you'll find you have to combine work done in the image builder with lower level api calls.
like adding a new blob directly to the target registry before you call addLayer.


`const RegistryClient = require('container-image-builder')` or
`import {RegistryClient} from 'container-image-builder`

- `client = new RegistryClient(registry, repository, auth)`
    - registry, string _required_
    - repository, string _required_
        - this is the image name including any namespace portion. so something like `my-google-project/my-app`
    - auth _required_
        - auth.Username
        - auth.Secret
        or 
        - auth.token

- `client.manifest(tag: string) Promise<Manifest>`
    - note: get the image manifest
    - tag, string _required_
        - this can be a tag name or a digest for manifests without tags.

- `client.tags() Promise<TagResult>`
    - note: list all tags associated with the image (repository)
    - no arguments.
    - TagResult 
        - child: any[];
        - manifest: {};
        - name: string;
        - tags: string[];

- `client.manifestUpload(tag: string|false, manifest: Buffer|{}) Promise<{status: number, digest: string, body: Buffer}>`
    - tag, string| false
        - if ! tag manifest will be uploaded untagged.
    - manifest
        - if manifest is a buffer it'll be uploaded as is.
        - if manifest is an object it'll be json.stringified and uploaded.
        - this does no verification at all. the registry api will fail if anything is wrong with it.

- `client.blobExists(digest) Promise<boolean>`
    - digest, string _required_
        - the sha256sum of the blob.
        - both layers and image configs are stored as blobs in the registry api

- `client.blob(digest, stream) Promise<Buffer|Readable>`
    - note: download a blob as a buffer or stream
    - digest, string _required_
        - the sha256 sum of the blob you want to download
    - stream, boolean
        - default false
        - if you'ed like to download to a buffer or resolve to a readable stream.

- `client.upload(blob, contentLength, digest) Promise<{contentLength: number, digest: string}> `
    - note: upload a blob to the registry. you do not need to know the content length and digest before hand. if they're not provided they'll be calculated on the fly and a 2 step upload will be performed. It's more efficient if you know the contentLength and digest beforehand, but if you're streaming it can be more efficient to calculate on the fly.
    - blob, Readable|Buffer _required_
        - a readable stream or buffer.
    - contentLength, number optional
        - the size in bytes of the blob.
    - digest, string optional
        - sha256sum of the blob.

- `client.mount(digest: string, fromRepository: string)`
    - note: likely incomplete. this is much faster than alternatives if it works =)
    - mount api has a neat feature where if the mount fails it'll give you a redirect header with the download url but this doesnt have the fallback bit implemented.
    - this also may need work around auth. in Image make a client to download from one and pipe to and upload on two.
    - digest, string _required_
        - the sha256 sum of the target blob
        - the repository to mount from.

## Common actions

TODO. recipes for common workflows here.

### update env vars or exec path of a container 

### add a layer to an image

### copy an image to another docker registry

## Notes

This is not an official google product.

