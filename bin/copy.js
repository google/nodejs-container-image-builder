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
