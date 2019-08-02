import * as assert from 'assert';
import {ChildProcess} from 'child_process';

import {RegistryClient} from '../src/registry';

import * as localRegistry from './util/local-registry';

describe(__filename, () => {
  let registryProcess: ChildProcess&{port: number};
  let port: number;

  before(async () => {
    /*if (process.platform === 'win32') {
       console.log(
           'Skipping registry integration test. There is no local registry image
     for windows available on docker hub'); this.skip(); return;
     }*/
    if (process.env.TEST_DOCKER_REGISTRY_PORT) {
      port = +process.env.TEST_DOCKER_REGISTRY_PORT;
      console.log('READING DOCKER REGISTRY PORT FROM ENVIRONMENT.');
      return;
    }
    registryProcess = await localRegistry.run();
    port = registryProcess.port;
    registryProcess.stdout.pipe(process.stdout, {end: false});
    registryProcess.stderr.pipe(process.stderr, {end: false});
    registryProcess.on('exit', (code) => {
      if (code) console.log('docker registry exited: ', code);
    });
  });

  after(() => {
    if (registryProcess) registryProcess.kill();
  });

  it('uploads blob to local docker registry', async () => {
    const blob = Buffer.from('hello world');

    const client = new RegistryClient('localhost:' + port, 'node');

    const result = await client.upload(blob);

    console.log(result);
    assert.strictEqual(
        result.digest,
        'sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
        'should have uploaded expected blob');
  });
});
