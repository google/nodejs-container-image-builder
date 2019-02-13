// @ts-check
let Image = require('./build/src').Image

let from = process.argv[2]

if(!from || from === '--help' || from === 'help'){
    console.error(`
    Usage:
        imagename
    `)
    process.exit(1)
}


let image = new Image(from)
image.getImageData().then((data)=>{
    console.log(JSON.stringify(data,null,'  '))
})
