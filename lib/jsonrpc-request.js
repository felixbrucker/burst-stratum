class JsonRpcRequest {
  static fromJSON(json) {
    const parsed = JSON.parse(json);

    return new JsonRpcRequest(parsed.id, parsed.method, parsed.params);
  }

  constructor(id, method, params) {
    this._id = id;
    this._method = method;
    this._params = params;
  }

  get id() {
    return this._id;
  }

  get method() {
    return this._method;
  }

  get params() {
    return this._params;
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
