const { v4: uuidv4 } = require('uuid');
const net = require('net');
const EventEmitter = require('events');

const JsonRpcRequest = require('./jsonrpc-request');
const JsonRpcResponse = require('./jsonrpc-response');

class BurstStratumServer {
  constructor(listenIp, listenPort) {
    this.listenIp = listenIp;
    this.listenPort = listenPort;
    this.server = net.createServer();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
    this.miningInfoByCoin = {};
    this.clientsByCoin = {};
    this.clients = {};
    this._init();
  }

  updateMiningInfo(coin, miningInfo) {
    this.miningInfoByCoin[coin] = miningInfo;
    if (!this.clientsByCoin[coin]) {
      return;
    }
    Object.keys(this.clientsByCoin[coin])
      .map(clientId => this.clientsByCoin[coin][clientId])
      .forEach(client => this._sendMiningInfo(client, coin, miningInfo));
  }

  onSubmitNonce(promiseFunction) {
    this.emitter.on('submitNonce', async ({ coin, submission, options }, cb) => {
      try {
        const result = await promiseFunction({ coin, submission, options });
        cb(null, result);
      } catch (err) {
        cb(err);
      }
    });
  }

  async start() {
    await new Promise(resolve => this.server.listen(this.listenPort, this.listenIp, resolve));
  }

  get activeConnections() {
    return Object.keys(this.clients).length;
  }

  _init() {
    this.server.on('connection', (client) => {
      client.id = uuidv4();
      this.clients[client.id] = client;
      this.emitter.emit('miner/connected', client);

      client.on('error', (err) => {});

      client.on('data', (data) => {
        const lines = data.toString('utf8').split('\n').filter(line => line);
        let jsonRpcRequests;
        try {
          jsonRpcRequests = lines
            .map(line => JsonRpcRequest.fromJSON(line))
            .filter(jsonRpcRequest => jsonRpcRequest.isValid());
        } catch (err) {
          throw new Error(`Error: received invalid JSON: ${err.message} (${lines.join('\n')})`);
        }
        jsonRpcRequests.forEach(jsonRpcRequest => {
          switch (jsonRpcRequest.method) {
            case JsonRpcRequest.METHOD_SUBSCRIBE:
              this._onSubscribe(client, jsonRpcRequest);
              break;
            case JsonRpcRequest.METHOD_SUBMIT:
              this._onSubmit(client, jsonRpcRequest);
              break;
          }
        });
      });

      client.on('close', () => {
        this.emitter.emit('miner/disconnected', client);
        delete this.clients[client.id];
        if (client.coins) {
          client.coins.forEach(coin => delete this.clientsByCoin[coin][client.id]);
        }
      });
    });
    this.server.on('error', (err) => {});
  }

  _onSubscribe(client, jsonRpcRequest) {
    const coins = jsonRpcRequest.params;
    if (!Array.isArray(coins) || coins.length === 0) {
      return this._sendJsonRpcMessage(client, new JsonRpcResponse({
        id: jsonRpcRequest.id,
        error: 'No coins provided as params',
      }));
    }
    if (client.coins) {
      client.coins.forEach(coin => delete this.clientsByCoin[coin][client.id]);
    }
    const invalidCoins = coins.filter(coin => !this.miningInfoByCoin[coin]);
    client.coins = coins.filter(coin => this.miningInfoByCoin[coin]);
    client.coins.forEach(coin => this._setClientForCoin(client, coin));
    if (invalidCoins.length > 0) {
      this._sendJsonRpcMessage(client, new JsonRpcResponse({
        id: jsonRpcRequest.id,
        error: `Invalid coins: ${invalidCoins.join(', ')}`,
      }));
    } else {
      this._sendJsonRpcMessage(client, new JsonRpcResponse({
        id: jsonRpcRequest.id,
        result: true,
      }));
    }
    this.emitter.emit('miner/subscribed', client);
    client.coins.forEach(coin => {
      const miningInfo = this.miningInfoByCoin[coin];
      if (!miningInfo) {
        this.emitter.emit('miner/subscribed/invalid-coin', client, coin);
      }
      this._sendMiningInfo(client, coin, this.miningInfoByCoin[coin]);
    });
  }

  _onSubmit(client, jsonRpcRequest) {
    if (!jsonRpcRequest.params.submission || !jsonRpcRequest.params.options || !jsonRpcRequest.params.coin) {
      return this._sendJsonRpcMessage(client, new JsonRpcResponse({
        id: jsonRpcRequest.id,
        error: 'Missing at least one parameter of "submission", "options" and "coin"',
      }));
    }
    jsonRpcRequest.params.options.ip = client.remoteAddress;
    this.emitter.emit('submitNonce', jsonRpcRequest.params, (err, result) => {
      if (err) {
        return this._sendJsonRpcMessage(client, new JsonRpcResponse({
          id: jsonRpcRequest.id,
          error: err.message,
        }));
      }
      this._sendJsonRpcMessage(client, new JsonRpcResponse({
        id: jsonRpcRequest.id,
        result,
      }));
    });
  }

  _sendMiningInfo(client, coin, miningInfo) {
    this._sendJsonRpcMessage(client, JsonRpcRequest.miningNotify({
      coin,
      miningInfo,
    }));
  }

  _sendJsonRpcMessage(client, jsonRpcMessage) {
    client.write(`${jsonRpcMessage.toJSON()}\n`);
  }

  _setClientForCoin(client, coin) {
    if (!this.clientsByCoin[coin]) {
      this.clientsByCoin[coin] = {};
    }
    this.clientsByCoin[coin][client.id] = client;
  }
}

module.exports = BurstStratumServer;
