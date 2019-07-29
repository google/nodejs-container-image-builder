/**
 * @fileoverview Description of this file.
 * 
 * run this with 
 * OTHER_GOOGLE_APPLICATION_CREDENTIALS=... OTHER_GOOGLE_APPLICATION_CREDENTIALS2=... node ./multiple-gcr.js
 */

if(!process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS || !process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS2){
  console.log('please provide application credentials to 2 google cloud projects in the environment variables\nOTHER_GOOGLE_APPLICATION_CREDENTIALS\nOTHER_GOOGLE_APPLICATION_CREDENTIALS2')
  process.exit(1)
}

const fs = require('fs')
const {Image} = require('../')

let main = async () => {
  const file1 = process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS
  const file2 = process.env.OTHER_GOOGLE_APPLICATION_CREDENTIALS2
  const creds1 = JSON.parse(fs.readFileSync(file1))
  const creds2 = JSON.parse(fs.readFileSync(file2))

  const baseImage = new Image('node:lts-slim','gcr.io/'+creds1.project_id+'/image',{auth:{'gcr.io':{credentials:creds1}}});
  console.log('created base image',await baseImage.save())


  const image = new Image('gcr.io/'+creds1.project_id+'/image','gcr.io/'+creds2.project_id+'/image',{
    auth:{
      ['gcr.io/'+creds1.project_id]:{credentials:creds1},
      ['gcr.io/'+creds2.project_id]:{credentials:creds2},
    }
  })

  const result = await image.save()

  console.log('copied base image from gcr registry 1 to gcr registry 2 with distinct credentials\n',result)
}

main()
