const net = require('net');
const EventEmitter = require('events');
const JsonRpcRequest = require('./jsonrpc-request');
const JsonRpcResponse = require('./jsonrpc-response');

class BurstStratumClient {
  static sendJsonRpcMessage(client, jsonRpcMessage) {
    client.write(`${jsonRpcMessage.toJSON()}\n`);
  }

  constructor(host, port, minerOptions = {}) {
    this.host = host;
    this.port = port;
    this.client = new net.Socket();
    this.events = new EventEmitter();
    this.minerOptions = minerOptions;
    this.init();
  }

  submitNonce(submission) {
    return this.sendRequestAndAwaitResponse(new JsonRpcRequest(
      2,
      'mining.submit',
      [ submission ]
    ));
  }

  onMiningInfo(cb) {
    this.subscribe('miningInfo', cb);
  }

  init() {
    this.subscribeToMiningNotify();

    this.client.on('close', async () => {
      await new Promise(resolve => setTimeout(resolve, 5 * 1000));
      await this.start();
    });
  }

  async start() {
    await new Promise(resolve => this.client.connect(this.port, this.host, resolve));
    await this.startSubscription();
  }

  subscribeToMiningNotify() {
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
        if (jsonRpcRequest.method !== 'mining.notify') {
          return;
        }
        if (jsonRpcRequest.params.length === 0) {
          throw new Error(`Error: Invalid submission format: ${JSON.stringify(jsonRpcRequest.params)}`);
        }
        this.publish('miningInfo', jsonRpcRequest.params[0]);
      });
    });
  }

  async startSubscription() {
    await this.sendRequestAndAwaitResponse(new JsonRpcRequest(
      1,
      'mining.subscribe',
      [{
        ...this.minerOptions,
      }]
    ));
  }

  async sendRequestAndAwaitResponse(jsonRpcRequest) {
    let handlerFunc = null;
    const result = await new Promise((resolve, reject) => {
      const expectResponse = (data) => {
        const lines = data.toString('utf8').split('\n').filter(line => line);
        let jsonRpcRequests = null;
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
            return reject(jsonRpcResponse);
          }
          resolve(jsonRpcResponse);
        });
      };
      handlerFunc = expectResponse;
      this.client.addListener('data', expectResponse);

      BurstStratumClient.sendJsonRpcMessage(this.client, jsonRpcRequest);
    });
    this.client.removeListener('data', handlerFunc);
    handlerFunc = null;

    return result;
  }

  publish(topic, ...msg) {
    this.events.emit(topic, ...msg);
  }

  subscribe(topic, cb) {
    this.events.on(topic, cb);
  }
}

module.exports = BurstStratumClient;
