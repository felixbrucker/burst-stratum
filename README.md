Burst-Stratum
======

[![Software License](https://img.shields.io/badge/license-GPL--3.0-brightgreen.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/npm/v/burst-stratum.svg?style=flat-square)](https://www.npmjs.com/package/burst-stratum)
[![npm weekly downloads](https://img.shields.io/npm/dw/burst-stratum.svg?style=flat-square)](https://www.npmjs.com/package/burst-stratum)

## Usage

### Server
```javascript
const { BurstStratumServer } = require('burst-stratum');

(async () => {
  const server = new BurstStratumServer('127.0.0.1', 12345);

  // Get miningInfo for specific miner or same for all
  server.onGetMiningInfoForMiner(async (miner = null) => {
    // Use same miningInfo for all here
    return {
      generationSignature: 'b8744e269e818e15e1ef552daefcfa4fa73e0d452816087dd24f6c3d86f26728',
      baseTarget: '56963',
      height: '594909',
    };
  });
  server.onSubmitNonce(async (submission, miner = null) => {
    // TODO: Do something with the submission

    // Return the result of the submission
    return {
      result: 'success',
      deadline: 12345,
    };
  });

  // Start listening for connections
  await server.start();

  // Update the miningInfo for all miners
  server.updateMiningInfo({
    generationSignature: '1234',
    baseTarget: '98765',
    height: '12345',
  });

  // Update the miningInfo for a specific miner
  const minerId = '127.0.0.1/myMinerName';
  server.updateMiningInfo({
    generationSignature: '1234',
    baseTarget: '98765',
    height: '12345',
  }, minerId);
})();
```

### Client
```javascript
const { BurstStratumClient } = require('burst-stratum');

(async () => {
  // Create the client and optionally configure miner options like minerName, accountKey, etc
  const client = new BurstStratumClient('localhost', 12345, {
    minerName: 'myName',
    miner: 'my awesome mining program',
    userAgent: 'my awesome user agent',
    capacity: '123',
    accountKey: '123',
    maxScanTime: 30,
  });

  client.onMiningInfo((miningInfo) => {
    // TODO: Do something with the new miningInfo
  });

  // Start connection and miningInfo subscription
  await client.start();

  await client.submitNonce({
    accountId: '12345',
    nonce: '123456789',
    blockheight: '594909',
    deadline: '12',
  });
})();
```

## License

GNU GPLv3 (see [LICENSE](https://github.com/felixbrucker/burst-stratum/blob/master/LICENSE))
