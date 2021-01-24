const EventEmitter = require('events');
const WebSocket = require('isomorphic-ws');
const Promise = require('promise');

class ExplorerBlockbook extends EventEmitter {
  constructor({ node }) {
    super();
    this.blockbookURL = node.replace(/\/+$/, "");
    // Setup..
    this.ws = false;
    this.wsConnected = false;
    this.pingPong = false;
    this.messageID = 0;
    this.pending = {};
    this.subscriptions = {};
    // Connect Websocket..
    this.connectWS();
  }

  isConnected () {
    if( ! this.wsConnected ) {
      return false;
    }

    return true;
  }

  async connectWS() {
    let url = this.blockbookURL.replace('https://', '');
    let wsURL = `wss://${url}/websocket`;
    this.ws = new WebSocket(wsURL);

    this.ws.onopen = () => {
      this.wsConnected = true;
      this.emit('connected', true);
    };

    this.ws.onclose = () => {
      this.wsConnected = false;
      clearInterval(this.pingPong);
      this.emit('connected', false);
    };

    this.ws.onmessage = (message) => {
      this.handleWSMessage(message);
    };

    this.pingpong = setInterval(() => {
      this.sendWS('ping', {}, false);
    }, 10000);
  }

  sendWS(method, params, callback) {
    let id = this.messageID.toString();
    this.messageID++;
    if (callback != false) {
      this.pending[id] = callback;
    }
    let req = {
      id,
      method,
      params
    }
    this.ws.send(JSON.stringify(req));
    return id;
  }

  // TODO
  // need to add rejection? timeout?

  async sendWSPromise(method, params) {
    return (() => {
      return new Promise((resolve, reject) => {
        this.sendWS(method, params, resolve);
      })
    })();
  }

  subscribeWS(method, params, callback) {
    let id = this.messageID.toString();
    this.messageID++;
    this.subscriptions[id] = callback;
    var req = {
      id,
      method,
      params
    }
    this.ws.send(JSON.stringify(req));
    return id;
  }

  handleWSMessage(message) {
    let resp;
    if (message['data'] !== undefined) {
      resp = JSON.parse(message.data);
      if (resp['data'] !== undefined) {
        resp = JSON.parse(message.data);
      }
    }

    let callback = this.pending[resp.id];
    if (callback != undefined) {
      delete (this.pending[resp.id]);
      callback(resp.data);
    } else {
      callback = this.subscriptions[resp.id];
      if (callback != undefined) {
        callback(resp.data);
      } else {
        // Do nothing.
        //console.log(`Unknown WS Response: ${resp.id}`);
      }
    }
  }

  async getAddressDetails(address) {
    let fetch = await this.fetchJSONAPIV2(`address/${address}`);
    return fetch;
  }

  async sendTransaction(txHex) {
    let fetch = await this.fetchJSONAPIV2(`sendtx/${txHex}`);
    return fetch;
  }

  async fetchJSONAPIV2(urlSuffix) {
    let url = this.blockbookURL + "/api/v2/" + urlSuffix;
    let result = await fetch(url).then(res => res.json()).then(json => {
      return json;
    });

    return result;
  }
}

module.exports = ExplorerBlockbook;