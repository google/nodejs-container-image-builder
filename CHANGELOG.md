## [2.0.3](https://github.com/google/nodejs-container-image-builder/compare/v2.0.2...v2.0.3) (2019-07-26)


### Bug Fixes

* pause and gcr auth should not work on new gcrs ([3a1f16c](https://github.com/google/nodejs-container-image-builder/commit/3a1f16c))
* replace spaen for cross-spawn in creds helper for windows ([1a27b6c](https://github.com/google/nodejs-container-image-builder/commit/1a27b6c))
* skipping gcr integration test on windows ([baf753a](https://github.com/google/nodejs-container-image-builder/commit/baf753a))
* undefined topath ([24922c5](https://github.com/google/nodejs-container-image-builder/commit/24922c5))
* windows link support workarounds in tests ([893e8ca](https://github.com/google/nodejs-container-image-builder/commit/893e8ca))


### Features

* do not sent auth information to 3rd parties after a redirect ([953eb3b](https://github.com/google/nodejs-container-image-builder/commit/953eb3b))
* support DOCKER_CONFIG env var to find config ([d7565b4](https://github.com/google/nodejs-container-image-builder/commit/d7565b4))



## [2.0.2](https://github.com/google/nodejs-container-image-builder/compare/v2.0.1...v2.0.2) (2019-07-10)


### Bug Fixes

* foix readme example ([a7a828a](https://github.com/google/nodejs-container-image-builder/commit/a7a828a))



## [2.0.1](https://github.com/google/nodejs-container-image-builder/compare/v2.0.0...v2.0.1) (2019-06-27)


### Bug Fixes

* unhandled rejection form getImageData after constructing an image ([#34](https://github.com/google/nodejs-container-image-builder/issues/34)) ([152b741](https://github.com/google/nodejs-container-image-builder/commit/152b741))



# [2.0.0](https://github.com/google/nodejs-container-image-builder/compare/v1.1.2...v2.0.0) (2019-06-26)


### Bug Fixes

* upgrading walkdir to 0.4.0 to fix error ([3b7d13f](https://github.com/google/nodejs-container-image-builder/commit/3b7d13f))


### Features

* support adding in memory files to layers ([#15](https://github.com/google/nodejs-container-image-builder/issues/15)) ([9b716ee](https://github.com/google/nodejs-container-image-builder/commit/9b716ee))


### BREAKING CHANGES

* image.addFiles obj keys and values flipped

image.addFiles(obj)
when paths are specified as an object the keys are now `targetDirectory`.
this enables copying the same files into a container to different paths and CustomFiles

* feat: custom files can be added to packs



## [1.1.2](https://github.com/google/nodejs-container-image-builder/compare/v1.1.0...v1.1.2) (2019-03-26)


### Bug Fixes

* fix image.WorkingDir not saving ([#4](https://github.com/google/nodejs-container-image-builder/issues/4)) ([61397cb](https://github.com/google/nodejs-container-image-builder/commit/61397cb))



# [1.1.0](https://github.com/google/nodejs-container-image-builder/compare/4066347...v1.1.0) (2019-02-21)


### Bug Fixes

* link to oci spec in readme ([f45a318](https://github.com/google/nodejs-container-image-builder/commit/f45a318))
* package.json updates ([8a771c2](https://github.com/google/nodejs-container-image-builder/commit/8a771c2))
* readme ([315a602](https://github.com/google/nodejs-container-image-builder/commit/315a602))


### Features

* adding files. ([4066347](https://github.com/google/nodejs-container-image-builder/commit/4066347))
* new pack/addFiles api and lots and lots of docs. ([533e599](https://github.com/google/nodejs-container-image-builder/commit/533e599))



