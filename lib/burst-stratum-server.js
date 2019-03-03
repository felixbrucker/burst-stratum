const net = require('net');
const EventEmitter = require('events');
const JsonRpcRequest = require('./jsonrpc-request');
const JsonRpcResponse = require('./jsonrpc-response');

class BurstStratumServer {
  static sendJsonRpcMessage(client, jsonRpcMessage) {
    client.write(`${jsonRpcMessage.toJSON()}\n`);
  }

  static sendMiningInfo(client, miningInfo) {
    BurstStratumServer.sendJsonRpcMessage(client, new JsonRpcRequest(
      null,
      'mining.notify',
      [ miningInfo ]
    ));
  }

  constructor(listenIp, listenPort) {
    this.listenIp = listenIp;
    this.listenPort = listenPort;
    this.server = net.createServer();
    this.subscribedClients = {};
    this.events = new EventEmitter();
    this.init();
  }

  updateMiningInfo(miningInfo, minerId = null) {
    Object.keys(this.subscribedClients)
      .map(clientId => this.subscribedClients[clientId])
      .forEach(client => {
        if (!minerId) {
          return BurstStratumServer.sendMiningInfo(client, miningInfo);
        }
        if (!client.miner) {
          return;
        }
        if (client.miner.minerId !== minerId) {
          return;
        }
        BurstStratumServer.sendMiningInfo(client, miningInfo);
      });
  }

  onSubmitNonce(promiseFunction) {
    this.subscribe('submitNonce', async (submission, miner, cb) => {
      try {
        const result = await promiseFunction(submission, miner);
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    });
  }

  onGetMiningInfoForMiner(promiseFunction) {
    this.subscribe('getMiningInfo', async (miner, cb) => {
      try {
        const result = await promiseFunction(miner);
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    });
  }

  async start() {
    await new Promise(resolve => this.server.listen(this.listenPort, this.listenIp, resolve));
  }

  init() {
    this.server.on('connection', (client) => {
      const clientId = `${client.remoteAddress}/${client.remotePort}`;

      client.on('data', (data) => {
        const lines = data.toString('utf8').split('\n').filter(line => line);
        let jsonRpcRequests = null;
        try {
          jsonRpcRequests = lines.map(line => JsonRpcRequest.fromJSON(line));
        } catch (err) {
          throw new Error(`Error: received invalid JSON: ${err.message} (${lines.join()})`);
        }
        jsonRpcRequests.forEach(jsonRpcRequest => {
          switch (jsonRpcRequest.method) {
            case 'mining.subscribe':
              this.subscribedClients[clientId] = client;
              if (jsonRpcRequest.params.length > 0) {
                // Save miner meta data
                client.miner = {
                  ...jsonRpcRequest.params[0],
                };
                client.miner.minerId = `${client.remoteAddress}/${client.miner.minerName}`;
              }
              BurstStratumServer.sendJsonRpcMessage(client, new JsonRpcResponse(
                jsonRpcRequest.id,
                true
              ));
              this.publish('getMiningInfo', client.miner, (err, miningInfo) => {
                if (err) {
                  throw new Error('Error: could not obtain miningInfo');
                }
                BurstStratumServer.sendMiningInfo(client, miningInfo);
              });
              break;
            case 'mining.submit':
              if (jsonRpcRequest.params.length === 0) {
                throw new Error(`Error: Invalid submission format: ${JSON.stringify(jsonRpcRequest.params)}`);
              }
              this.publish('submitNonce', jsonRpcRequest.params[0], client.miner, (err, result) => {
                if (err) {
                  return BurstStratumServer.sendJsonRpcMessage(client, new JsonRpcResponse(
                    jsonRpcRequest.id,
                    null,
                    err.message
                  ));
                }
                BurstStratumServer.sendJsonRpcMessage(client, new JsonRpcResponse(
                  jsonRpcRequest.id,
                  result
                ));
              });
              break;
          }
        });
      });

      client.on('close', () => {
        if (!this.subscribedClients[clientId]) {
          return;
        }
        delete this.subscribedClients[clientId];
      });
    });
  }

  publish(topic, ...msg) {
    this.events.emit(topic, ...msg);
  }

  subscribe(topic, cb) {
    this.events.on(topic, cb);
  }
}

module.exports = BurstStratumServer;
