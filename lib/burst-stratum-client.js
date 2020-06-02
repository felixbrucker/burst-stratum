const net = require('net');
const EventEmitter = require('events');
const { URL } = require('url');

const JsonRpcRequest = require('./jsonrpc-request');
const JsonRpcResponse = require('./jsonrpc-response');

class BurstStratumClient {
  constructor(url) {
    const { protocol, hostname, port } = new URL(url);
    if (protocol !== 'stratum+tcp:') {
      throw new Error('Invalid protocol');
    }
    this.host = hostname;
    this.port = parseInt(port, 10);
    this.coins = [];
    this.client = new net.Socket();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);

    this._subscribeToMiningNotify();

    this.client.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.connect();
      await this.subscribe(this.coins);
    });
    this.client.on('error', (err) => console.log(err.message));
  }

  submitNonce({ coin, submission, options }) {
    return this._sendRequestAndAwaitResponse(JsonRpcRequest.miningSubmit({
      coin,
      submission,
      options,
    }));
  }

  onMiningInfo(cb) {
    this.emitter.on('miningInfo', cb);
  }

  async connect() {
    await new Promise(resolve => this.client.connect(this.port, this.host, resolve));
  }

  async subscribe(coins) {
    this.coins = coins;
    await this._sendRequestAndAwaitResponse(JsonRpcRequest.miningSubscribe(this.coins));
  }

  _subscribeToMiningNotify() {
    this.client.on('data', (data) => {
      const lines = data.toString('utf8').split('\n').filter(line => line);
      let jsonRpcRequests = null;
      try {
        jsonRpcRequests = lines
          .map(line => JsonRpcRequest.fromJSON(line))
          .filter(jsonRpcRequest => jsonRpcRequest.isValid());
      } catch (err) {
        throw new Error(`Error: received invalid JSON: ${err.message} (${lines.join()})`);
      }
      jsonRpcRequests.forEach(jsonRpcRequest => {
        if (jsonRpcRequest.method !== JsonRpcRequest.METHOD_NOTIFY) {
          return;
        }
        this.emitter.emit('miningInfo', jsonRpcRequest.params);
      });
    });
  }

  async _sendRequestAndAwaitResponse(jsonRpcRequest) {
    let handlerFunc = null;
    const result = await new Promise((resolve, reject) => {
      const expectResponse = (data) => {
        const lines = data.toString('utf8').split('\n').filter(line => line);
        let jsonRpcRequests;
        try {
          jsonRpcRequests = lines
            .map(line => JsonRpcResponse.fromJSON(line))
            .filter(jsonRpcResponse => jsonRpcResponse.isValid());
        } catch (err) {
          throw new Error(`Error: received invalid JSON: ${err.message} (${lines.join()})`);
        }
        jsonRpcRequests.forEach(jsonRpcResponse => {
          if (jsonRpcResponse.id !== jsonRpcRequest.id) {
            return;
          }
          if (jsonRpcResponse.error) {
            return reject(jsonRpcResponse.error);
          }
          resolve(jsonRpcResponse.result);
        });
      };
      handlerFunc = expectResponse;
      this.client.addListener('data', expectResponse);

      this._sendJsonRpcMessage(jsonRpcRequest);
    });
    this.client.removeListener('data', handlerFunc);
    handlerFunc = null;

    return result;
  }

  _sendJsonRpcMessage(jsonRpcMessage) {
    this.client.write(`${jsonRpcMessage.toJSON()}\n`);
  }
}

module.exports = BurstStratumClient;
