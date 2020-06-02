const { v4: uuidv4 } = require('uuid');

class JsonRpcRequest {
  static get METHOD_SUBMIT() {
    return 'mining.submit';
  }
  static get METHOD_SUBSCRIBE() {
    return 'mining.subscribe';
  }
  static get METHOD_NOTIFY() {
    return 'mining.notify';
  }

  static fromJSON(json) {
    const { id, method, params } = JSON.parse(json);

    return new JsonRpcRequest({ id, method, params });
  }

  static miningSubmit({ coin, submission, options }) {
    return new JsonRpcRequest({
      id: uuidv4(),
      method: JsonRpcRequest.METHOD_SUBMIT,
      params: {
        coin,
        submission,
        options,
      },
    });
  }

  static miningSubscribe(coins) {
    return new JsonRpcRequest({
      id: uuidv4(),
      method: JsonRpcRequest.METHOD_SUBSCRIBE,
      params: coins,
    });
  }

  static miningNotify({ coin, miningInfo }) {
    return new JsonRpcRequest({
      id: null,
      method: JsonRpcRequest.METHOD_NOTIFY,
      params: {
        coin,
        miningInfo,
      },
    });
  }

  constructor({ id, method, params }) {
    this.id = id;
    this.method = method;
    this.params = params;
  }

  toJSON() {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: this.id,
      method: this.method,
      params: this.params,
    });
  }

  isValid() {
    return !!this.method && !!this.params;
  }
}

module.exports = JsonRpcRequest;
