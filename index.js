// nxswap-js 
// index.js > Start!

const crypto = require('crypto');

const Networks = require('./src/networks');
const NXMeta = require('./src/core/NXMeta/NXMeta');

const NXLocalStorage = require('./src/core/NXLocalStorage/NXLocalStorage');
const NXDB = require('./src/core/NXDB/NXDB');
const NXRecoveryKey = require('./src/core/NXRecoveryKey/NXRecoveryKey');
const ExplorerBlockbook = require('./src/core/NXExplorers/ExplorerBlockbook');
const NXWallet = require('./src/core/NXWallet/NXWallet');
const NXNegotiator = require('./src/core/NXNegotiator/NXNegotiator');
const NXPBMsgr = require('./src/core/NXPBMsgr/NXPBMsgr');

// Setup Local Storage
const LocalStorage = new NXLocalStorage();

// fixed support for now.. 
const SUPPORTED_CURRENCIES = ["TBTC", "TLTC", "TVTC"];
// eventually this will allow to add / remove currencies via a function.

// Setup Explorers..
const explorers = {};
for( let net of SUPPORTED_CURRENCIES ) {
	let network = Networks[net];
	let defaultBlockbook = network.defaultBlockbook;
	if( !defaultBlockbook || defaultBlockbook === undefined) continue;
	let explorer = new ExplorerBlockbook({
		node: defaultBlockbook
	});
	explorers[net] = explorer;
}

// Initiate NXDB
const nxDB = new NXDB({});
nxDB.initialiseDB();

// Connect to PBMsgr
const PBMsgr = new NXPBMsgr({
	WSUrl: 'wss://api-dev.pbmsgr.com:8000/connection/websocket',
	sign: false
});

// NXWallet
const Wallet = new NXWallet();
let UserAuthObject = false;

Wallet.on('initialised', (state) => {
	console.log(`wallet init ${state}`)
	if( state ) {
		let sign = Wallet.getUserAuthObject();
		let pubKey = sign.pubKey.toString('hex');
		let pubKeyHash = crypto.createHash('sha256').update(pubKey).digest('hex');
		UserAuthObject = {
			pubKey: pubKey,
			pubKeyHash: pubKeyHash
		}
		PBMsgr.updateSign(sign);
		PBMsgr.connectWebsocket();
		// Start negotiator
		Negotiator.start();
	} else {
		PBMsgr.updateSign(false);
		// disconnect from channel
		// add in unsubscribe here..!!!
	}
});

// NXNegotiator
const Negotiator = new NXNegotiator({
	nxDB: nxDB,
	wallet: Wallet,
	msgr: PBMsgr
});

PBMsgr.on('publish', (message) => {
	Negotiator.handleIncomingPeerMessage(message);
})

// NXRecoveryKey
const RecoveryKey = new NXRecoveryKey({
	storage: LocalStorage
});

// NXRecoveryKey Events
RecoveryKey.on('ready', (state) => {
	if(state) {
		// Ready!
		let mnemonic = RecoveryKey.recoveryKey.Wallet.mnemonic;
		if( ! mnemonic || mnemonic === undefined ) return false;
		// Init wallet..
		Wallet.initialiseWallet({
			fromMnemonic: mnemonic,
			explorers: explorers,
			nxDB: nxDB
		});
	} else {
		// Not ready.. lock..?
		// Need to uninitialise Wallet..
	}
});

// Do Bits..
async function start () {
	console.log('--- nxswap-js ---');
	console.log('-- attempting to auto load RecoveryKey --');

	const loadRecoveryKey = await RecoveryKey.loadRecoveryKey({
		autoCreate: false
	});

	// Failure to auto load, it can be manually loaded.
	if( ! loadRecoveryKey ) {
		console.log('-- no RecoveryKey auto loaded. manual load required.. --');
	}
}




start();

module.exports = { NXLocalStorage, NXRecoveryKey, ExplorerBlockbook, NXWallet, NXNegotiator, NXPBMsgr, Networks, LocalStorage, RecoveryKey, Wallet, Negotiator, PBMsgr, NXMeta, UserAuthObject, SUPPORTED_CURRENCIES };