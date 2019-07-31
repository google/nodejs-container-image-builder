import {RegistryClient} from '../src/registry';
import * as localRegistry from './util/local-registry';
import { ChildProcess } from 'child_process';
import * as assert from 'assert';

describe(__filename,()=>{

  let registryProcess:ChildProcess&{port:number};

  before(async ()=>{
    console.log('mocha: before')
    registryProcess = await localRegistry.run()
    //registryProcess.stdout.pipe(process.stdout,{end:false})
    //registryProcess.stderr.pipe(process.stderr,{end:false})
    registryProcess.on('exit',(code)=>{
      console.log('docker registry exited: ',code)
    })
  })

  after(()=>{
    console.log('mocha: after')
    if(registryProcess) registryProcess.kill()
  })

  it('creates image in registry',async ()=>{

    console.log('starting test')

    let client = new RegistryClient('localhost:'+registryProcess.port, 'test', {token:'aaa'});
    let tags = await client.tags();//('sha256:98ea6e4f216f2fb4b69fff9b3a44842c38686ca685f3f55dc48c5d3fb1107be4');
    //assert.ok(!exists,'blob should not exist');
    console.log(tags)
  })

})
