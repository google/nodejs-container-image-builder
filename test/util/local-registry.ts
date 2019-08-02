import * as cp from 'child_process';
import * as http from 'http';
import {AddressInfo} from 'net';



const registryImage = 'registry';
// if (process.platform === 'win32') {
// // it was taking over 40 seconds to pull this image so i moved it to an azure
// pipelines step instead.
// // this assumes you run teats on windows with linuxc container enabled.
//  registryImage = 'stefanscherer/registry-windows';
//}

export const run = async (attempts = 0) => {
  const port = await freePort();

  return await new Promise<cp.ChildProcess&
                           {port: number}>((resolve, reject) => {
    const proc =
        cp.spawn(
            'docker', ['run', '-p', port + ':5000', registryImage + ':latest'],
            {stdio: 'pipe'}) as cp.ChildProcess &
        {port: number};

    proc.port = port;
    proc.stdin.end();
    const timer = setTimeout(() => {
      if (process.platform === 'win32') {
        resolve(proc);
        return;
      }
      proc.kill();
      reject(new Error(
          'docker registry did not start listening within 10 seconds.'));
    }, 30000);

    const exitHandler = (code: number) => {
      clearTimeout(timer);
      reject(new Error(
          'local docker registry process exited before being ready with code ' +
          code));
    };

    let out = Buffer.alloc(0);
    const outHandler = (buf: Buffer) => {
      console.log('out:' + buf);
      out = Buffer.concat([out, buf]);
    };

    let bufs = Buffer.alloc(0);
    const errHandler = (buf: Buffer) => {
      bufs = Buffer.concat([bufs, buf]);
      console.log('err:' + buf);
      if ((bufs + '').indexOf('msg="listening on') > -1) {
        proc.removeListener('exit', exitHandler);
        proc.stdout.removeListener('data', outHandler);
        proc.stderr.removeListener('data', errHandler);
        clearTimeout(timer);
        resolve(proc);
        // re-emit data that we've consumed.
        // proc.stdout.emit('data', out);
        // proc.stderr.emit('data', bufs);
        proc.stdout.unshift(out);
        proc.stderr.unshift(bufs);
      }
    };

    proc.stdout.on('data', outHandler);
    proc.stderr.on('data', errHandler);
    proc.once('exit', exitHandler);
  });
};


export const freePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(() => {});
    server.listen(0, (err: Error) => {
      if (err) return reject(err);
      const port = (server.address() as AddressInfo).port;
      server.close(() => {
        resolve(port);
      });
    });
  });
};
