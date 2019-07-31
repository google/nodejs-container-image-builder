import * as cp from 'child_process';
import * as http from 'http';
import { AddressInfo } from 'net';

export const run = async ()=>{
  let port = await freePort()

  return await new Promise<cp.ChildProcess&{port:number}>((resolve,reject)=>{
    const proc = cp.spawn('docker',['run', '-p',port+':5000', 'registry:latest'],{stdio:'pipe'}) as cp.ChildProcess&{port:number}
    //proc.stdin.end();
    proc.port = port;

    const timer = setTimeout(()=>{
      proc.kill()
      reject(new Error('docker registry did not start listening within 10 seconds.'))
    },10000)

    const exitHandler = (code:number)=>{
      clearTimeout(timer)
      reject(new Error('local docker registry process exited before being ready with code '+code))
    }

    let out = Buffer.alloc(0)
    const outHandler = (buf:Buffer)=>{
      out = Buffer.concat([out,buf])
    }

    let bufs = Buffer.alloc(0);
    const errHandler = (buf:Buffer)=>{
      bufs = Buffer.concat([bufs,buf])
      
      if((bufs+'').indexOf('msg="listening on') > -1){
        proc.removeListener('exit',exitHandler)
        proc.stdout.removeListener('data',outHandler);
        proc.stderr.removeListener('data',errHandler);
        clearTimeout(timer);
        resolve(proc)
        // re-emit data that we've consumed.
        proc.stdout.unshift(out);
        proc.stderr.unshift(bufs);
      }
    }

    proc.once('exit',exitHandler)
    proc.stdout.on('data',outHandler)
    proc.stderr.on('data',errHandler)
  })
}


export const freePort = ():Promise<number> =>  {
  return new Promise((resolve,reject)=>{
    const server = http.createServer(()=>{});
    server.listen(0,(err:Error)=>{
      if(err) return reject(err)
      const port = (server.address() as AddressInfo).port
      server.close(()=>{
        resolve(port)
      })
    })
  })
}

