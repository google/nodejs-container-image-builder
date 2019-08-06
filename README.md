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

;(async()=>{
const image = new Image('node:lts-slim','gcr.io/my-project/my-image')

// add local files to the image.
await image.addFiles({'/directory-root-for-files-in-container':"./"})

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

Docker hub and gcr.io have custom auth plugins.  If you already have a token or username and secret you can pass them directly when making an Image client.

```js
const image = new Image('node:lts-slim','myspecialregistry.io/my-project/my-image',{
    "auth":{
        'myspecialregistry.io':{
            token:"xxxxxxxxxxx"
        }
    }
})
```
`node:lts-slim` is a public image so no need to provide auth for docker.io

Also if you have a docker credential helper installed on the system, and in your docker config that matches the registry we'll call it before giving up.



see <a href="#docker-registry-auth">auth information</a> for more.


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

- `image = new Image(baseImage:string,targetImage:string|ImageOptions,options:ImageOptions)`
    - baseImage
        the name of the base image. these are image specifiers just like you would pass to other container tools.
    - targetImage
        the name of the image you're going to be saving to. calls to image.save() will replace this image.
    - options
        - see <a href="#ImageOptions">ImageOptions</a> for options.
        - see <a href="#docker-registry-auth">Detailed auth information</a> for more about how to authenticate with any registry.

- `image.addFiles({[targetDirectory]:localDirectory},options): Promise<..>`

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

    - _BREAKING CHANGE_ between 1x AND 2x
        - positions of `targetDirectory` and `localDirectory` were flipped in the object.
        - when paths are specified as an object the keys are now `targetDirectory`. 
        - this enables copying the same files into a container to different paths and CustomFiles

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

- `const {CustomFile} = require('container-image-builder')`
    - you can pass CustomFile to image.addFiles as a localPath to write in memory data or a stream to the layer tarball.
    - `image.addFiles({'/help.md':new CustomFile({data:Buffer.from('hello')})})`
    - `image.addFiles({'/google.html':new CustomFile({data:request('https://google.com'),size:**you must have size beforehand for streams**})})`
    - useful for creating whiteout files etc.

- `customFile = new CustomFile(options)`
    - options
        - mode
            - defaults to `0o644` owner read write, everyone read. 
            - see [fs.chmod](https://nodejs.org/dist/latest-v10.x/docs/api/fs.html#fs_file_modes)
            - permission bits are extracted from the mode provided via `& 0o7777` and type bits are set based on type.
        - size
            - required if stream. optional with buffer
        - data
            - a stream or buffer of data which will be the contents of the file.
            - required if type is File
        - type
            - defaults to File
            - supported are File, Directory, Symlink
        - linkPath
            - only used if Symlink

- `customFile.uid`
    - default 0. set to number if you want to set uid
- `customFile.gid`
    - default 0. set to number if you want to set gid
- `customFile.ctime`
    - default new Date(). set to Date if you want to set
- `customFile.atime`
    - default new Date(). set to Date if you want to set
- `customFile.mtime`
    - default new Date(). set to Date if you want to set

- <a name="ImageOptions">ImageOptions</a>
    - ImageOptions is an object with the optional key auth. if `auth` is provided it will be used to provided authentication metadata for calls to the specified registry. If there is no authentication provider for your particular registry you can an object with the key token as it's value.
    - `{auth:{'my.registry.io':{token?:string}}}`
    - default support for docker.io and google container registry (gcr.io) are built in.
    - if your registry has `gcr.io` in it you can pass <a href="#GCRAuthOptions">additional options</a>.

- <a name="GCRAuthOptions">GCRAuthOptions</a>
    - {credentials?:{private_key:string,client_email:string},keyFilename?:string,token?:string}
    - if no options are provided it falls back to using GOOGLE_APPLICATION_CREDENTIALS to provide the keyFilename
    - the values for crdentials normally come from a key file like you would pass to keyFilename and download as service account credentials.


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
        - options['any.gcr.io/google-cloud-project']
        - options['any.gcr.io']
        - options['gcr.io'] = {...}
            - see <a href="#GCRAuthOptions">GCRAuthOptions</a> for valid properties.
            - you can also set the environment variable `GOOGLE_APPLICATION_CREDENTIALS=path to key file.json` and it will work as expected like other google client libraries.
            - if you need to authenticate to multiple GCR projects you can provide multiple sets of crdentials directly as auth options.

        - options['docker.io'] = {...}
            - accepts these options. all are strings.
            - either `token` is required or `Username`,`Secret` is required. we'll either try Basic or Bearer auth depending on credentials provided.
            - `options.Secret`
            - `options.Username`
            - `options.token`
        - options[ any other registry ] = {Username:string,Secret:string} or {token:string}
            - if username and secret is provided the client will attempt to use http basic auth
            - if token is provided it will use Bearer header auth.

#### credential helpers

if docker is configured to look for credentials in credentials helpers authentication will be fetched from them automatically
https://docs.docker.com/engine/reference/commandline/login/#credential-helpers

this library does not attempt to read base64 or credentials from a secret service/keychain on the host.

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
        - if you'd like to download to a buffer or resolve to a readable stream.

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

### Authenticating to multiple GCR projects

this example copies 'gcr.io/project1/image' to 'us.gcr.io/project2/image' . 
The credentials value is the parsed JSON object from the file in GOOGLE_APPLICATION_CREDENTIALS

```js
const creds1 = JSON.parse(fs.readFileSync(process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS))
const creds2 = JSON.parse(fs.readFileSync(process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS2))
const image = new Image('gcr.io/project1/image','us.gcr.io/project2/image',{
  "auth":{
    'us.gcr.io/project2':{credentials:creds1},
    'gcr.io/project1':{credentials:creds2},
  }
})

console.log(await image.save())
```
[working example script](./examples/multiple-gcr.js)


### update env vars or exec path of a container 

### add a layer to an image

### copy an image to another docker registry

## Notes

This is not an official google product.

