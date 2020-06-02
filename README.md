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

  // Register the submission handler
  server.onSubmitNonce(async ({ coin, submission, options }) => {
    // Submit/Validate the submission

    // Return the result of the submission
    return {
      result: 'success',
      deadline: 12345,
    };
  });

  // Configure the initial mining info
  server.updateMiningInfo('BHD', {
    generationSignature: '1471e5075e2207e70a9ac46ea46f740dc0c981a4ec336c534e647917904febc6',
    baseTarget: 25256,
    height: 330800,
    targetDeadline: 31536000,
  });
  server.updateMiningInfo('BURST', {
    generationSignature: '2a61cd695b14fe850bd2cbf95bb45c94a9316831d8c952fc439ff299eaa12772',
    baseTarget: 34985,
    height: 758335,
    targetDeadline: 31536000,
  });

  // Start listening for connections
  await server.start();

  // Update the miningInfo and notify all subscribed clients for this coin
  server.updateMiningInfo('BHD', {
    generationSignature: '6b914699608eede35bbecac30414e6e2ee282601b4410c6f6301988647753faa',
    baseTarget: 23455,
    height: 330900,
    targetDeadline: 31536000,
  });
})();
```

### Client
```javascript
const { BurstStratumClient } = require('burst-stratum');

(async () => {
  const client = new BurstStratumClient('stratum+tcp://localhost:12345');

  // Register the new miningInfo handler
  client.onMiningInfo(({ coin, miningInfo }) => {
    // Do something with the new miningInfo
  });

  // Establish a connection to the burst-stratum server
  await client.connect();

  // Subscribe to the coins you want to receive miningInfo for
  await client.subscribe(['BHD', 'BURST']);

  // Submit to the burst-stratum server
  const result = await client.submitNonce({
    coin: 'BHD',
    submission: {
      height: 330900,
      accountId: '12312134123123',
      nonce: '32462454345354',
      deadline: 23213232,
    },
    options: {
      minerName: 'Miner 1',
      accountName: 'My Name',
      payoutAddress: '33fKEwAHxVwnrhisREFdSNmZkguo76a2ML',
      userAgent: 'Foxy-Miner 1.13.0',
      capacity: 1337, // Capacity in GiB
      distributionRatio: '0-100',
    },
  });
})();
```

## License

GNU GPLv3 (see [LICENSE](https://github.com/felixbrucker/burst-stratum/blob/master/LICENSE))
