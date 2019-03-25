#!/usr/bin/env node

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

// @ts-check
let Image = require('../build/src').Image

let from = process.argv[2]

if(!from || from === '--help' || from === 'help'){
    console.error(`
    Usage:
        from to tag,tag,tag

    to
        optional. defaults to from
    tag
        optional. defaults to 'latest'
        can pass string of comma separated tags
    `)
    process.exit(1)
}

let to = process.argv[3]
let tags = (process.argv[4]||'').split(',')

let image = new Image(from,to)

image.save(tags).then(console.log)
