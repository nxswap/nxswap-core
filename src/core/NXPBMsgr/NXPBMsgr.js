// nxswap-js > NXPBMsgr
// NXPBMsgr.js

const EventEmitter = require('events');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const Centrifuge =  require('centrifuge');
const ws = require('ws');
const axios = require('axios');
const { appendFileSync } = require('fs');

class NXPBMsgr extends EventEmitter {
  constructor({
    WSUrl,
    nodejs,
    sign
  }) {
    super();
    if(WSUrl === undefined) return false;
    this.sign = sign;
    this.jwt = false;
    this.wsConnected = false;
    this.wsClientUUID = false;
    this.WSUrl = WSUrl;
    this.nodejs = nodejs;
    
    this.channels = {};
  }

  updateSign(sign) {
    this.sign = sign;
  }

  async validateAuth() {
    if( ! this.jwt ) {
      await this.getAuthToken();
      if( ! this.jwt ) {
        return false;
      }
      return true;
    }

    return true;
  }

  async getAuthToken() {
    let pubKey = Buffer.from(this.sign.pubKey);
    let getChallenge = await axios.post('https://api-dev.pbmsgr.com/api/v1/challenge', {
      challenge: {
        request: 'authenticate',
        payload: pubKey.toString('hex')
      }
    });

    let result = getChallenge.data;
    if( ! result || ! result.success ) return false;

    let challenge = result.result.challenge;
    if( ! challenge || ! challenge.hash || ! challenge.expires ) return false;

    let post = {
      challenge: challenge
    }

    let sign = this.signRPCWithAuth(post);

    let authenticate = await axios.post('https://api-dev.pbmsgr.com/api/v1/authenticate', post, {
      headers: {
        'PB-PUBKEY': pubKey.toString('hex'),
        'PB-SIGNATURE': sign.signature,
        'PB-HASH': sign.messageHash
      }
    });

    let authresult = authenticate.data;
    if( ! authresult || ! authresult.success ) return false;

    authresult = authresult.result;

    if( ! authresult || ! authresult.token ) return false;

    let token = authresult.token;
    this.jwt = token;
  }

  async connectWebsocket() {
    let auth = await this.validateAuth();
    if( ! auth ) return false;

    let options = {
      debug: false
    }

    if( this.nodejs ) {
      options.websocket = ws;
    }

    this.ws = new Centrifuge(this.WSUrl, options);
    this.ws.setToken(this.jwt);

    this.ws.on('connect', (result) => { this.websocketConnected(result) });
    this.ws.on('disconnect', (result) => { this.websocketDisconnected(result) });
    this.ws.on('subscribe', (result) => { this.websocketSubscribe(result) });
    this.ws.on('publish', (result) => { this.websocketPublish(result) });

    // Connect
    this.ws.connect();
  }

  websocketConnected(result) {
    console.log(`WS API Connected! Client UUID ${result.client}`);
    console.log(result);
    this.wsConnected = true;
    this.wsClientUUID = result.client;
    this.emit('connected', true);
  } 

  websocketDisconnected(result) {
    console.log(`WS API Disconnected!`);
    console.log(result);
    this.wsConnected = false;
    this.wsAPIClearCurrent();
    this.emit('connected', false);
  }

  websocketSubscribe(result) {
    console.log('subscribe', result);
    this.emit('subscribe', result);
  }

  websocketPublish(result) {
    console.log('publish', result);
    this.emit('publish', result.data);
  }

  wsAPIClearCurrent() {
    this.wsClientUUID = false;
  }

  // Subscribe channel

  subscribeChannel(channel, callbacks) {
    if (this.channels[channel] != null) {
      this.channels[channel].subscribe();
    } else {
      // Default Callbacks..
      if( ! callbacks || typeof(callbacks) !== "object" ) {
        callbacks = {};
      }

      if( callbacks.publish === undefined ) {
        callbacks.publish = (payload) => {
          this.callbackPublish(channel, payload);
        }
      }
      if( callbacks.subscribe === undefined ) {
        callbacks.subscribe = (payload) => {
          this.callbackSubscribe(channel, payload);
        }
      }

      if( callbacks.unsubscribe === undefined ) {
        callbacks.unsubscribe = (payload) => {
          this.callbackUnsubscribe(channel, payload);
        }
      }

      if( callbacks.error === undefined ) {
        callbacks.error = (payload) => {
          this.callbackError(channel, payload);
        }
      }

      let subscribe = this.ws.subscribe(channel, callbacks);
      this.channels[channel] = subscribe;
    }
  }

  callbackPublish(channel, payload) {
    if( payload.data === undefined ) return false;
    let data = payload.data;

    if( data.event !== undefined ) {
      let event = data.event;
      let payload = data.payload;
      let signature = data.signature;

      // verify signature?...
      // Emit..
      this.emit(event, payload);
    } else {
      console.log(`rec unknown message`, channel, data);
    }
  }

  callbackSubscribe(channel, payload) {
    console.log( 'subscribe', channel, payload );
  }

  callbackUnsubscribe(channel, payload) {

  }

  callbackError(channel, payload) {

  }

  unsubscribeChannel(channel) {
    if (this.channels[channel] != null) {
      this.channels[channel].unsubscribe();
      this.channels[channel].removeAllListeners();
      delete this.channels[channel];
    }
  }

  isSubscribed(channel) {
    if (this.channels[channel] !== null) {
      return true;
    }
    return false;
  }

  async RESTAPIPost(method, payload) {
    if( !method) return false;

    let sign = this.signRPCWithAuth(payload);

    console.log(method, payload);

    let post = await axios.post(`https://api-dev.pbmsgr.com/api/v1/${method}`, payload, {
      headers: {
        'PB-PUBKEY': sign.pubKeyHex,
        'PB-SIGNATURE': sign.signature,
        'PB-HASH': sign.messageHash
      }
    });

    if( ! post ) return false;
    return post.data;
  }

  // RPC
  async wsAPIRPC({
    method,
    payload,
    sign
  }) {
    if (!this.wsConnected) return false;
    if (!method) return false;

    let rpcObj = {
      client: this.wsClientUUID,
      method: method
    }

    if( payload !== false && typeof( payload ) === "object" ) {
      rpcObj.payload = payload;
    }

    if( sign === true ) {
      if( this.sign === undefined || typeof(this.sign) !== "object" ) {
        return false;
      }

      // sign with stored..
      let sign = this.signRPCWithAuth(rpcObj);
      if (!sign) return false;
      let signature = sign.signature;
      let messageHash = sign.messageHash;
      let pubKeyHex = sign.pubKeyHex;
  
      rpcObj.verify = {
        hash: messageHash,
        pubKey: pubKeyHex,
        signature: signature
      }
    }

    let result = await this.ws.rpc(rpcObj).then((res) => {
      return res;
    }, (err) => {
      console.log('rpc error', err);
      console.log(JSON.stringify(rpcObj));
      return false;
    });

    return result;
  }

  signRPCWithAuth(object) {
    let message = JSON.stringify(object);
    let messageHash = crypto.createHash('sha256').update(message).digest('hex');
    let messageBuf = Buffer.from(messageHash, 'hex');

    let signObject = this.sign;
    if( ! signObject.pubKey || ! signObject.privKey ) return false;

    let pubKey = signObject.pubKey;
    let privKey = signObject.privKey;

    // sign the message
    const sigObj = secp256k1.ecdsaSign(messageBuf, privKey)
    let sigBuf = Buffer.from(sigObj.signature);
    let signature = sigBuf.toString('base64');

    // Sanity verify..
    let verifyBuf = Buffer.from(signature, 'base64');
    const verify = secp256k1.ecdsaVerify(verifyBuf, messageBuf, pubKey);

    let pubKeyHex = pubKey.toString('hex');

    if (verify) {
      return {
        pubKeyHex,
        signature,
        messageHash
      }
    } else {
      return false;
    }
  }

  signString(string) {
    let messageBuf = Buffer.from(string, 'hex');

    let signObject = this.sign;
    if( ! signObject.pubKey || ! signObject.privKey ) return false;

    let pubKey = signObject.pubKey;
    let privKey = signObject.privKey;

    // sign the message
    const sigObj = secp256k1.ecdsaSign(messageBuf, privKey)
    let sigBuf = Buffer.from(sigObj.signature);
    let signature = sigBuf.toString('base64');

    // Sanity verify..
    let verifyBuf = Buffer.from(signature, 'base64');
    const verify = secp256k1.ecdsaVerify(verifyBuf, messageBuf, pubKey);

    let pubKeyHex = pubKey.toString('hex');

    if (verify) {
      return {
        signature
      }
    } else {
      return false;
    }
  }
}

module.exports = NXPBMsgr;
