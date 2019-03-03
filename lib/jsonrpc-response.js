class JsonRpcResponse {
  static fromJSON(json) {
    const parsed = JSON.parse(json);

    return new JsonRpcResponse(parsed.id, parsed.result, parsed.error);
  }

  constructor(id, result, error = null) {
    this._id = id;
    this._result = result;
    this._error = error;
  }

  get id() {
    return this._id;
  }

  get result() {
    return this._result;
  }

  get error() {
    return this._error;
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
    return this.result !== undefined;
  }
}

module.exports = JsonRpcResponse;
