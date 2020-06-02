class JsonRpcResponse {
  static fromJSON(json) {
    const { id, result, error } = JSON.parse(json);

    return new JsonRpcResponse({ id, result, error });
  }

  constructor({ id, result, error }) {
    this.id = id;
    this.result = result;
    this.error = error;
  }

  toJSON() {
    return JSON.stringify({
      jsonrpc: '2.0',
      id: this.id,
      result: this.result,
      error: this.error,
    });
  }

  isValid() {
    return !!this.result || !!this.error;
  }
}

module.exports = JsonRpcResponse;
