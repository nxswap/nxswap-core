// nxswap-js > NXWallet 
// NXWallet.js
const EventEmitter = require('events');
const crypto = require('crypto');
const bitcoinjs = require('bitcoinjs-lib');
const bip32 = require('bip32');
const bip32grs = require('bip32grs')
const bip39 = require('bip39');
const secp256k1 = require('secp256k1');
const constants = require('bip44-constants');
const bs58check = require('bs58check');
const bs58grscheck = require('bs58grscheck')
const coinSelect = require('coinselect');
const coinSelectSplit = require('coinselect/split');
const date = require('date-and-time');

const { BindToClass } = require('../NXUtil/NXUtil')
const Swaps = require('./Swaps');
const SwapRoutine = require('./SwapRoutine');
const WalletUtils = require('./WalletUtils');

const networks = require('../../networks');
const HIGHEST_BIT = 2147483648; // 0x80000000

class NXWallet extends EventEmitter {
  initialiseWallet({
    fromMnemonic,
    fromSeed,
    accountIndex,
    explorers,
    nxDB
  }) {
    this.emit('initialised', false);
    // check for nxDB
    if( ! nxDB || nxDB === undefined ) return false;
    this.nxDB = nxDB;
    // seed
    this.seed = false;
    let seed = false;
    if (!fromSeed) {
      seed = this.loadSeedFromMnemonic(fromMnemonic);
    } else {
      seed = Buffer.from(fromSeed, 'hex');
    }
    // Is seed a valid seed? validation maybe..
    if (!seed) return false;
    this.seed = seed;
    // Account index?
    if( isNaN(accountIndex) ) {
      this.accountIndex = 0;
    } else {
      this.accountIndex = accountIndex;
    }
    // supported currencies..
    this.supportedCurrencies = [];
    for( let net in networks ) {
      this.supportedCurrencies.push(net);
    }

    // Bind
    BindToClass( WalletUtils, this );
    BindToClass( Swaps, this );
    BindToClass( SwapRoutine, this );
    // init!
    this.emit('initialised', true);
    // Wallet..
    this.activeCurrencies = [];
    this.root = {};
    this.priv = {};
    this.pub = {};
    this.pubPath = {};
    this.zpub = {};
    this.nextIndex = {};
    this.nextChangeIndex = {};
    this.derivedAddresses = {};
    this.balancesAvailable = {};
    this.balancesPending = {};
    this.utxos = {};
    this.txids = {};
    this.transactions = {};
    this.transactionLedger = {};
    this.subscribeAddresses = {};
    this.subscribeBlocks = {};
    // Explorers..
    this.explorers = {};
    if (explorers != undefined) {
      for (let tick in explorers) {
        let network = networks[tick];
        if (network == undefined) continue;
        let explorer = explorers[tick];
        this.explorers[tick] = explorer;
        this.prepareNetwork(tick);
      }
    }
    // Swap Monitor
    this.swapMonitorRoutineTimeout = false;
    this.swapStatusMeta = {};
    this.startSwapMonitorRoutine();
  }

  isInitialised() {
    if( ! this.seed ) {
      return false;
    }
    return true;
  }

  // is Swap DB? ready?
  isNXDBInitialised() {
    if( this.nxDB === false ) return false;
    if( this.nxDB.db === false ) return false;
    return true;
  }

  // Set Explorer
  // Explorers can be passed into initialise, or called seperately with setExplorer
  setExplorer(tick, explorer) {
    if (!tick || !explorer) return false;
    let network = networks[tick];
    if (network == undefined) return false;
    this.explorers[tick] = explorer;
    this.prepareNetwork(tick);
  }

  // Prepare Network
  // Taking the ticker, sets the basework.
  prepareNetwork(net) {
    let network = networks[net];
    if (network == undefined) return false;
    this.activeCurrencies.push(net);
    // priv..
    let priv
    if(net === "TGRS") {
      priv = bip32grs.fromSeed(this.seed, network);
    } else {
      priv = bip32.fromSeed(this.seed, network);
    }
    
    this.root[net] = priv;
    let testnet = (network.testnet) ? true : false;
    let cointype = (testnet) ? 1 : this.getCoinType(net); // all testnet coin 1
    if (!cointype) return false;
    priv = priv.derivePath(`m/84'/${cointype}'/${this.accountIndex}'`);
    let xprv = priv.toBase58();
    // pub..
    let pub = priv.neutered();
    let xpub = pub.toBase58();
    // z fix... 
    let bip84 = this.bip32ToBip84Prefix(xprv, xpub, network);
    // Store..
    this.priv[net] = priv;
    this.pub[net] = pub;
    this.pubPath[net] = `m/84'/${cointype}'/${this.accountIndex}'`;
    this.zpub[net] = bip84.zpub;
    // Addresses
    this.nextIndex[net] = 0;
    this.nextChangeIndex[net] = 0;
    this.derivedAddresses[net] = { 0: {}, 1: {}};
    // store..
    this.utxos[net] = [];
    this.txids[net] = [];
    this.transactions[net] = [];
    this.transactionLedger[net] = {};
    // Subscription..
    this.subscribeAddresses[net] = false;
    this.subscribeBlocks[net] = false;
    // Bindings..
    // On Connected..
    if( this.explorers[net].wsConnected ) {
      this.syncWallet(net);
    } else {
      this.explorers[net].on('connected', (status) => {
        if (!status) {
          // Undo!
        } else {
          this.syncWallet(net);
        }
      });
    }
  }

  // Sync Wallet
  async syncWallet(net) {
    let network = networks[net];
    if (network == undefined) return false;
    let pub = this.pub[net];
    if (pub == undefined) return false;
    let zpub = this.zpub[net];
    // Send zpub to explorer
    let fetchZpub;
    let explorer = this.explorers[net];

    try {
      fetchZpub = explorer.sendWS('getAccountInfo', {
        descriptor: zpub,
        page: 1,
        pageSize: 1000,
        details: 'txids',
        tokens: 'used',
      }, (response) => {
        this.parseAccountInfoResponse(net, zpub, response);
      });

      // Also fetch utxos..
      explorer.sendWS('getAccountUtxo', {
        descriptor: zpub,
      }, (response) => {
        this.parseAccountUtxoResponse(net, response);
      });
    } catch (e) {
      // failed
      console.log(e);
      fetchZpub = false;
    }

    if (!fetchZpub) {
      console.log(`Unable to fetch xpub details for ${net}`);
      return false;
    }

    return true;
  }

  // Parse account Info response..
  parseAccountInfoResponse(net, zpub, response) {
    // Prep
    let pubPath = this.pubPath[net];
    let page = response.page;
    let pages = response.totalPages;
    //console.log(`Received Account Info for ${net}, begin sync..page ${page} of ${pages} ${pubPath}..`);
    // multiple pages?
    if( pages > page ) {
      let explorer = this.explorers[net];
      page++;
      explorer.sendWS('getAccountInfo', {
        descriptor: zpub,
        page: page,
        pageSize: 1000,
        details: 'txids',
        tokens: 'used',
      }, (response2) => {
        this.parseAccountInfoResponse(net,zpub,response2);
      });
    }
    // Balances..
    let balance = parseInt(response.balance);
    let unconfirmedBalance = parseInt(response.unconfirmedBalance);
    let totalReceived = parseInt(response.totalReceived);
    let totalSent = parseInt(response.totalSent);
    let txCount = response.txs;

    // Balances..
    let available = 0;
    let pending = 0;
    if( unconfirmedBalance < 0 ) {
      available = balance + unconfirmedBalance;
      pending = 0;
    } else if( unconfirmedBalance >= 0 ) {
      available = balance;
      pending = unconfirmedBalance;
    }

    this.balancesAvailable[net] = available;
    this.balancesPending[net] = pending;

    console.log(`${net} Available: ${available}, pending: ${pending}, (confirmed ${balance}, unconfirmed ${unconfirmedBalance}, txCount: ${txCount})`);

    // Used?
    if (available == 0 && pending == 0 && totalSent == 0) {
      //console.log(`Sync finished for ${net}. Unused.`);
      // Start Subscriptions..
      this.handleSubscriptions(net);
      this.sendBalancesUpdate();
      return false;
    }    

    // Tokens..
    let usedTokens = response.usedTokens;
    let tokens = response.tokens;

    if (usedTokens > 0) {
      for (let token of tokens) {
        let path = token.path;
        let pathMinusPub = path.replace(`${pubPath}/`, '');
        let pathSplit = pathMinusPub.split('/');
        let isChangePath = (pathSplit[0] == 1) ? true : 0;
        let index = parseInt(pathSplit[1]);
        let transfers = token.transfers;

        if (transfers == undefined || transfers > 0) {
          let nextIndex = (isChangePath) ? this.nextChangeIndex[net] : this.nextIndex[net];
          if (index >= nextIndex) {
            index++;
            if (isChangePath) {
              this.nextChangeIndex[net] = index;
            } else {
              this.nextIndex[net] = index;
            }
          }
        }
      }
    }

    let txids = response.txids;
    if (txids !== undefined && txids.length > 0) {
      this.txids[net] = txids;
      this.syncTransactions(net);
    }

    this.handleSubscriptions(net);
    this.sendBalancesUpdate();
  }

  // Sync transactions for network..
  syncTransactions(net) {
    let txids = this.txids[net];
    if( ! txids || txids == undefined || txids.length == 0 ) {
      return false;
    }

    let explorer = this.explorers[net];   
    if( ! explorer || explorer === undefined ) {
      return false;
    }   

    for( let txid of txids ) {
      explorer.sendWS('getTransaction', {
        txid: txid
      }, (response) => {
        this.parseGetTransactionResponse(net, response);
      });
    }
  }

  // parse get transaction response..
  parseGetTransactionResponse(net, response) {
    if( response.error !== undefined ) {
      return false;
    }
    let txid = response.txid;
    // Store tx for later use..
    this.transactions[net][txid] = response;
    // Parse..
    let vins = response.vin;
    let vouts = response.vout;
    
    let txOutcome = 0;

    // Process ins..
    let externalIn = false;
    let inAddress = [];
    for( let vin of vins ) {
      let vinAddress = vin.addresses;
      if( vinAddress.length > 1 ) {
        // er
      } else {
        vinAddress = vinAddress[0];
      }
      let isWalletAddress = this.isWalletAddress(net, vinAddress);
      if( isWalletAddress !== false ) {
        // This was this wallet paying into the tx..
        let val = parseInt(vin.value);
        txOutcome -= val;
        inAddress.push(vinAddress);
      } else {
        externalIn = true;
      }
    }
    // process outs..
    let externalOut = false;
    let outAddress = [];
    for( let vout of vouts ) {
      let voutAddress = vout.addresses;
      if( voutAddress.length > 1 ) {
        // er
      } else {
        voutAddress = voutAddress[0];
      }
      let isWalletAddress = this.isWalletAddress(net, voutAddress);
      if( isWalletAddress !== false ) {
        // This wallet recieved from thi stx..
        let val = parseInt(vout.value);
        txOutcome += val;
        if( externalIn ) {
          outAddress.push(voutAddress);
        }

        // Increase index? maybe unconfirmed
        let nextIndex = (isWalletAddress.isChangeAddress) ? this.nextChangeIndex[net] : this.nextIndex[net];

        if( isWalletAddress.HDIndex >= nextIndex ) {
          if( isWalletAddress.isChangeAddress ) {
            this.nextChangeIndex[net] = isWalletAddress.HDIndex++;
          } else {
            let next = isWalletAddress.HDIndex + 1;
            this.nextIndex[net] = next;
          }
        }
      } else  {
        externalOut = true;
        if( ! externalIn ) {
          outAddress.push(voutAddress);
        }
      }
    }

    // Blocktime..
    let now = new Date();
    let today = date.format(now, 'YYYY/MM/DD');
    let blockTime = new Date(response.blockTime * 1000);
    let txDay = date.format(blockTime, 'YYYY/MM/DD');

    let when = '';
    // tx was today..
    if( today === txDay ) {
      when = date.format(blockTime, 'HH:mm A');
    } else {
      when = txDay;
    }

    // Calculate..
    let hash = crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex');
    let adjFormatted = this.formatBalanceDecimals(txOutcome, 100000000, 8);
    let ledger = {
      hash: hash,
      txid: txid,
      when: when,
      adj: txOutcome,
      adjFormatted: adjFormatted,
      descType: '',
      desc: ''
    };

    if( !externalIn && !externalOut ) {
      // Self payment..
      ledger.descType = 'Internal';
      ledger.desc = 'Payment to self';
    } else if( externalIn ) {
      // Deposit..
      ledger.descType = 'Deposit';
      let desc = outAddress[0];
      ledger.desc = `${desc}`;
    } else if( externalOut ) {
      // Send
      ledger.descType = 'Payment'
      let desc = outAddress[0];
      ledger.desc = `${desc}`;
    }

    this.transactionLedger[net][txid] = ledger;    
  }

  parseAccountUtxoResponse(net, response) {
    if( ! response || response.length === 0 ) {
      response = [];
    }

    this.utxos[net] = response;
    this.sendUtxoUpdate();
  }

  handleSubscriptions(net) {
    if (!this.subscribeAddresses[net]) {
      this.handleAddressSubscription(net);
    }
    if (!this.subscribeBlocks[net]) {
      this.handleBlockSubscription(net);
    }
  }

  handleAddressSubscription(net) {
    //console.log(`Handling address subscription ${net}..`);
    let explorer = this.explorers[net];
    let network = networks[net];
    let nextIndex = this.nextIndex[net];
    let nextChangeIndex = this.nextChangeIndex[net];

    // Ok we go plus 20 of the current indexes..standard.
    let subscribeIndex = nextIndex + 20;
    let subscribeChangeIndex = nextChangeIndex + 20;

    //console.log(`${net} subscribe up to 0/${subscribeIndex}..1/${subscribeChangeIndex}`);

    // Create address array..
    let pub = this.pub[net];
    let indexChangeArray = [0, 1];
    let addressArray = [];

    for (let change in indexChangeArray) {
      let to = (change == 1) ? subscribeChangeIndex : subscribeIndex;
      for (let i = 0; i <= to; i++) {
        let next = pub.derivePath(`${change}/${i}`);
        let address = bitcoinjs.payments.p2wpkh({ pubkey: next.publicKey, network: network }).address;
        addressArray.push(address);
        this.derivedAddresses[net][change][i] = address;
      }
    }

    // Subscribe
    this.subscribeAddresses[net] = true;
    explorer.subscribeWS('subscribeAddresses', {
      addresses: addressArray
    }, (result) => {
      this.receiveAddressSubscriptionMessage(net, result);
    });
  }

  handleBlockSubscription(net) {
    let explorer = this.explorers[net];
    // Subscribe
    this.subscribeBlocks[net] = true;
    explorer.subscribeWS('subscribeNewBlock', {}, (result) => {
      this.receiveBlockSubscriptionMessage(net, result);
    });
  }

  receiveAddressSubscriptionMessage(net, message) {
    if (message.subscribed !== undefined) {
      if (message.subscribed) {
        return true;
      } else {
        this.subscribeAddresses[net] = false;
        return false;
      }
    }
    // Oo a new tx..
    this.syncWallet(net);
  }

  receiveBlockSubscriptionMessage(net, message) {
    if (message.subscribed !== undefined) {
      if (message.subscribed) {
        return true;
      } else {
        this.subscribeBlocks[net] = false;
        return false;
      }
    }
    // Oo a new block..
    this.syncWallet(net);
  }

  sendBalancesUpdate () {
    let balanceUpdate = {}

    for( let net of this.activeCurrencies ) {
      let available = this.balancesAvailable[net];
      let pending = this.balancesPending[net];

      let availableFormatted = this.formatBalanceDecimals(available, 100000000, 8);
      let pendingFormatted = this.formatBalanceDecimals(pending, 100000000, 8);

      let update = {
        available: {
          raw: available,
          formatted: availableFormatted,
          float: parseFloat(availableFormatted)
        },
        pending: {
          raw: pending,
          formatted: pendingFormatted,
          float: parseFloat(pendingFormatted)
        }
      }

      balanceUpdate[net] = update;
    }

    this.emit('balanceUpdate', balanceUpdate);
  }

  sendUtxoUpdate () {
    this.emit('utxoUpdate', this.utxos);
  }

  formatBalanceDecimals(balance, div, decimals) {
    let bal = 0;
    let neg = false;
    if( balance > 0 ) {
      bal = balance / div;
    } else if( balance < 0 ) {
      neg = true;
      bal = Math.abs(balance) / div;
    }
    bal = bal.toFixed(decimals);
    if( neg ) {
      bal = `-${bal}`;
    }
    return bal;
  }

  // getNextAddress
  // (change) true or false, whether you require a change address.
  // Returns the next available address

  getNextAddress(net, change) {
    let network = networks[net];
    if (!net || network == undefined) return false;

    let nextIndex = (change) ? this.nextChangeIndex[net] : this.nextIndex[net];
    let pub = this.pub[net];
    let pubPath = this.pubPath[net];

    let changeOrNotPath = (change) ? 1 : 0;
    let next = pub.derivePath(`${changeOrNotPath}/${nextIndex}`);
    let nextPath = `${pubPath}/${changeOrNotPath}/${nextIndex}`;
    let nextShortPath = `${changeOrNotPath}/${nextIndex}`;
    let address = bitcoinjs.payments.p2wpkh({ pubkey: next.publicKey, network: network });
    let nextAddress = address.address;

    return {
      nextPath,
      nextShortPath,
      nextAddress
    }
  }

  // Get Previous Addresses..
  // Returns all the addresses and paths up to the current next address..

  getPreviousAddresses(net) {
    let network = networks[net];
    if (!net || network == undefined) return false;
    let pub = this.pub[net];
    let pubPath = this.pubPath[net];
    
    if( !pub || pub === undefined ) {
      return false;
    }

    let addressArray = [];
    let nextIndex = this.nextIndex[net];

    if( nextIndex == 0 ) {
      return false;
    }

    for (let i = nextIndex; i >= 0; i--) {
      let path = pub.derivePath(`0/${i}`);
      let address = bitcoinjs.payments.p2wpkh({ pubkey: path.publicKey, network: network }).address;
      let fullPath = `${pubPath}/0/${i}`;
      let addr = {
        address: address,
        fullPath: fullPath,
        shortPath: `0/${i}`
      }
      addressArray.push(addr);
    }

    return addressArray;
  }

  // NXSwap API Authentication
  // Users authenticate by signing messages from their NXWallet.
  // Path m/84'/7888'/999'/0'/0' ... hopefully not used? ever? maybe..

  getUserAuthPubKey() {
    if( ! this.isInitialised() ) return false;
    let auth = bip32.fromSeed(this.seed, networks.BTC);
    auth = auth.derivePath(`m/84'/7888'/999'/0'/0'`).neutered();
    let pubKey = auth.publicKey.toString('hex');
    return pubKey;
  }

  getUserAuthObject() {
    if( ! this.isInitialised() ) return false;
    let auth = bip32.fromSeed(this.seed, networks.BTC);
    auth = auth.derivePath(`m/84'/7888'/999'/0'/0'`);
    let privKey = auth.privateKey;
    let pubKey = auth.neutered().publicKey;
    return {
      privKey,
      pubKey
    }
  }

  // Parse utxos for send & coinSelect??
	// Currently returns them into a format for sending, as well as fee estimation..

	parseUTXOSForSend(net, preUtxos, selectedUtxoKeys, prepareTransaction) {
		if (!preUtxos || preUtxos.length == 0) return false;

		var utxos = [];

		for (let utxo of preUtxos) {
      let address = utxo.address;
      let txid = utxo.txid;
      let vout = utxo.vout;
      let value = utxo.value;
      let key = `${txid}-${vout}-${value}`;

      if( selectedUtxoKeys !== false ) {
        if( selectedUtxoKeys.length == 0 ) {
          return false;
        }

        if( ! selectedUtxoKeys.includes(key) ) {
          continue;
        }
      }

      let getTx = this.transactions[net][txid];
      if( getTx === undefined ) continue;

			// get full vout index..
      let txVouts = getTx.vout;

			for (let txVout of txVouts) {
				if (txVout.n == utxo.vout) {
					vout = txVout;
					break;
				}
      }
      
			// Base object.. across all types
			let utxoObject = {
				txId: utxo.txid,
        vout: parseInt(utxo.vout),
        address: address,
				value: parseInt(utxo.value),
      }

      // segwit.. for support of non segwit, would need to detect output type and add nonWitnessUtxo
      utxoObject.witnessUtxo = {
        script: Buffer.from(vout.hex, 'hex'),
        value: parseInt(utxo.value)
      }   

			utxos.push(utxoObject);
    }
    
		return utxos;
  }
  
  isPaymentFactory(payment) {
    return script => {
      try {
        bitcoinjs.payment({ output: script });
        return true;
      } catch (err) {
        return false;
      }
    };
  }

  // Calculate Transaction Fee
  // this could be improved.. coinSelect does not support segwit.. just temp.. TODO
  calculateTransactionFee(net, selectedUtxoKeys, targets, feeRate, prepareTransaction) {
    let network = networks[net];
    if( !network || network === undefined) return false;

    let utxos = this.utxos[net];

    // parse utxos..
    let parseUtxos = this.parseUTXOSForSend(net, utxos, selectedUtxoKeys, prepareTransaction);

    if( ! feeRate ) {
      // Get Default..
      if( network.minimumFeeByte === undefined ) {
        return false;
      }
      feeRate = network.minimumFeeByte;
    }

    let select = coinSelect(parseUtxos, targets, feeRate);

    if( !select.inputs || !select.outputs || selectedUtxoKeys !== false ) {
      // Possible send max.. try split
      let selectSplit = coinSelectSplit(parseUtxos, targets, feeRate);

      if( !selectSplit.inputs || !selectSplit.outputs ) {
        return false;
      }

      return selectSplit;
    }

    return select;
  }

  // Create Send Transaction

  createSendTransaction(net, selectedUtxoKeys, targets, feeRate) {
    let network = networks[net];
    if( !network || network === undefined) return false;

    let calculate = this.calculateTransactionFee(net, selectedUtxoKeys, targets, feeRate, true);


    if( ! calculate || ! calculate.inputs || ! calculate.outputs ) {
      return false;
    }

    let inputs = calculate.inputs;
    let outputs = calculate.outputs;
    let fee = calculate.fee;

    // Build TX
    var tx = new bitcoinjs.Psbt({ network: network });
    let pubPath = this.pubPath[net];
    let pub = this.pub[net];
    let priv = this.priv[net];

    for (let input of inputs) {
      // Add input..
      let thisInput = {
        hash: input.txId,
        index: input.vout,
      }
      // BIP 32 HD?
      let bip32HDPath = false;
      let address = input.address;
      let HDIndex = Object.keys(this.derivedAddresses[net][0]).find(key => this.derivedAddresses[net][0][key] === address);
      let pathMatchChange = 0;
      // Maybe its change..
      if( HDIndex === undefined ) {
        HDIndex = Object.keys(this.derivedAddresses[net][1]).find(key => this.derivedAddresses[net][1][key] === address);
        if( HDIndex !== undefined ) pathMatchChange = 1;
      }
      // We found a match..
      if( HDIndex !== undefined ) {
        let fingerprint = this.root[net].fingerprint;
        let bip32HDPath = `${pubPath}/${pathMatchChange}/${HDIndex}`;
        let pubkey = this.pub[net].derivePath(`${pathMatchChange}/${HDIndex}`).publicKey;
        let bip32Derivation = {
          masterFingerprint: fingerprint,
          path: bip32HDPath,
          pubkey: pubkey
        }
        console.log(pubkey.toString('hex'))
        thisInput.bip32Derivation = [bip32Derivation];
      }
      // witness or no witness..
			if (input.hasOwnProperty('nonWitnessUtxo')) {
        thisInput.nonWitnessUtxo = input.nonWitnessUtxo;
			}
			else if (input.hasOwnProperty('witnessUtxo')) {
				thisInput.witnessUtxo = input.witnessUtxo;
      }
      console.log(thisInput)
      tx.addInput(thisInput);
		}

		outputs.forEach(output => {
			// Any unassigned values, will be sent to a new change address..
			if (!output.address) {
        let change = this.getNextAddress(net,true);
				output.address = change.nextAddress;
			}
			tx.addOutput({
				address: output.address,
				value: output.value,
			})
    })

    /*
    console.log(tx.getFee());
    console.log(tx.getFeeRate());
    console.log(tx.__CACHE.__EXTRACTED_TX.virtualSize());
    */
    
    tx.signAllInputsHD(this.root[net]);
		tx.validateSignaturesOfAllInputs();
    tx.finalizeAllInputs();


    let txRawHex = tx.extractTransaction().toHex();
    
    console.log(txRawHex)
    return txRawHex;
  }

  async sendTransaction(net, txHex) {
    let network = networks[net];
    if( !network || network === undefined) return false;

    let explorer = this.explorers[net];
    if( ! explorer || explorer === undefined ) return false;

    // cheating and sending over https api..
    // could send over ws, promises and stuff.
    let send = await explorer.sendTransaction(txHex);
    this.syncWallet(net);
    return send.result;
  }

  // Util to search derived addresses if this address is ours..
  // only searches in the boundaries of +20 last used.. maybe a way to detect otherwise?

  isWalletAddress(net, address) {
    let HDIndex = Object.keys(this.derivedAddresses[net][0]).find(key => this.derivedAddresses[net][0][key] === address);
    let isChangeAddress = 0;
    // Maybe its change..
    if( HDIndex === undefined ) {
      HDIndex = Object.keys(this.derivedAddresses[net][1]).find(key => this.derivedAddresses[net][1][key] === address);
      if( HDIndex !== undefined ) isChangeAddress = 1;
    }

    if( HDIndex === undefined ) {
      return false;
    }

    isChangeAddress = (isChangeAddress === 0) ? false : true;
    HDIndex = parseInt(HDIndex);

    return {
      HDIndex,
      isChangeAddress
    }
  }

  // Util.. validate crypto address..
  validateCryptoAddress(address, net) {
    let network = networks[net];
    if( !network || network === undefined) return false;
		try {
			bitcoinjs.address.toOutputScript(address, network)
			return true
		} catch (e) {
			return false
		}
	}

  // Util > bip32 to bip84 prefix fix for blockbook
  bip32ToBip84Prefix(priv, pub, network) {
    let bip84 = network.bip84;
    let zpubPrefix;
    let zprvPrefix;
    if (!bip84 || bip84 == undefined) {
      if (network.testnet) {
        zpubPrefix = '045f1cf6'; // vpub
        zprvPrefix = '045f18bc'; // vprv
      } else {
        zpubPrefix = '04b24746'; // zpub
        zprvPrefix = '04b2430c'; // zprv
      }
    } else {

      let zpubBuffer = Buffer.allocUnsafe(4);
      zpubBuffer.writeUInt32BE(bip84.public, 0);
      zpubPrefix = zpubBuffer.toString('hex');

      let zprvBuffer = Buffer.allocUnsafe(4);
      zprvBuffer.writeUInt32BE(bip84.private, 0);
      zprvPrefix = zprvBuffer.toString('hex');
    }

    if (!zpubPrefix || !zprvPrefix) return false;

    // xprv to zprv
    
    let xprv
    let xpub
    let zprv
    let zpub 

    if( network.bech32 === "tgrs" ) {
      
      xprv = bs58grscheck.decode(priv);
      xprv = xprv.slice(4);
      xprv = Buffer.concat([Buffer.from(zprvPrefix, 'hex'), xprv]);
      zprv = bs58grscheck.encode(xprv);
      xpub = bs58grscheck.decode(pub);
      xpub = xpub.slice(4);
      xpub = Buffer.concat([Buffer.from(zpubPrefix, 'hex'), xpub]);
      zpub = bs58grscheck.encode(xpub);
    } else {
      
      xprv = bs58check.decode(priv);
      xprv = xprv.slice(4);
      xprv = Buffer.concat([Buffer.from(zprvPrefix, 'hex'), xprv]);
      zprv = bs58check.encode(xprv);
      xpub = bs58check.decode(pub);
      xpub = xpub.slice(4);
      xpub = Buffer.concat([Buffer.from(zpubPrefix, 'hex'), xpub]);
      zpub = bs58check.encode(xpub);
    }
   
    return {
      zpub,
      zprv
    }
  }

  // Util > Get Coin Type
  getCoinType(ticker) {
    const coin = constants.filter(item => item[1] === ticker);
    if (coin.length == 0) return false;
    const bip44 = coin[0][0];
    const sub = bip44 - HIGHEST_BIT;
    return sub;
  }

  // Util > Load Seed From Mnemonic
  loadSeedFromMnemonic(mnemonic) {
    let seed;
    try {
      seed = bip39.mnemonicToSeedSync(mnemonic);
    } catch (e) { }

    if (!seed) {
      return false;
    }
    return seed;
  }

  returnExplorer(currency) {
    if( this.explorers[currency] !== undefined && this.explorers[currency] !== false ) {
      return this.explorers[currency];
    }

    return false;
  }

  // VERY NAUGHTY! LOOK AWAY
  // cheat function
  // Converting old atomic swap code to new nxswap HD wallet
  // ??? TODO?

  returnSigningObjectForAddress(net, address) {
    let network = networks[net];
    if( !network || network === undefined) return false;

    let isAddress = this.isWalletAddress(net, address);

    if( ! isAddress ) return false;

    console.log('isAddress', isAddress);

    let changePath = (isAddress.isChangeAddress) ? 1 : 0;
    let privkey = this.priv[net].derivePath(`${changePath}/${isAddress.HDIndex}`).privateKey;

    let sign = bitcoinjs.ECPair.fromPrivateKey(privkey, network);

    return sign;
  }
}

module.exports = NXWallet;