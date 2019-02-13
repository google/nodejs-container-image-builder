container-image-builder
=======================

without any docker dependency this is a container registry client and image builder with support for protocol version 2

This library comes in 2 parts. 

- an Image class. which takes care of authentication and creating new registry clients. 
- registry clients. perform exactly the api calls defined in the (oci spec.)[https://github.com/opencontainers/distribution-spec/blob/master/spec.md]

you can do most things with the Image class. It takes care of tedious tasks like copying layers missing from one registry into another so you can save your new image.

## example

create a new image based off of the official node image with your files in it.

```js
import {Image} from 'container-image-builder'

;(async()=>{
const image = new Image('node:lts-slim','gcr.io/my-project/my-image')

// add local files to the image.
await image.addFiles("./",'/directory-root-for-files-in-container')

// creates a layer in the image with files like
// /directory-root-for-files-in-container/[the files in ./]

// set the default working directory for commands
image.WorkingDir = "/directory-root-for-files-in-container"
// set the default command to run in the container
image.Cmd = ["node","index.js"]
// set environment variables. does not remove old env vars.
image.Env = []

// save the new image at latest
const result = await image.save()

console.log(result)
})();
```

run the image

```sh
docker run gcr.io/my-project/my-image:latest

```

## install

```
npm install container-image-builder
```

## API

- `require('container-image-builder').Image` or `import {Image} from 'container-image-builder'`

### Image builder API

- image = new Image(baseImage:string,targetImage:string)
    - baseImage
        the name of the base image. these are image specifiers just like you would pass to other container tools.
    - targetImage
        the name of the image you're going to be saving to. calls to image.save() will replace this image.

- image.addFiles(localDirectory:string,targetDirectory:string) :Promise<..>
    - tar a local directory as a layer and place it at targetDirectory in the image
    - does not support symlinks outside of the localDirectory.

### registry client API

as you get more creative you'll find you have to combine work done in the image builder with lower level api calls.
like adding a new blob directly to the target registry before you call addLayer.

todo

## Common actions

### update env vars or exec path of a container 

### add a layer to an image

### copy an image to another docker registry

## notes

This is not an official google product.

