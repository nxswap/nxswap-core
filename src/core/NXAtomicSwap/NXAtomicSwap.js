// nxswap-js > NXAtomicSwap 
// NXAtomicSwap.js

// This is kind of a wrapper class for future expansion.
// Currently only BTC coins are supported by nxswap

const networks = require('../../networks');
const NXAtomicSwapBTC = require('./coins/NXAtomicSwapBTC')

const NXAtomicSwapUtil = require('./NXAtomicSwapUtil');

module.exports = {

  // Create Atomic Swap Secret Pair
  createAtomicSwapSecretPair: function () {
    let secret = NXAtomicSwapUtil.returnSecret(64);
		let secretHash = NXAtomicSwapUtil.returnSecretHash(secret);

		return {
			secret,
			secretHash
		}
	},
	
	// Create Atomic Swap Contract

	createAtomicSwapContract: function (currency, params) {
		if( !currency ) return false;

		let loadNetwork = networks[currency];
		if( ! loadNetwork ) return false;

		let networkType = loadNetwork.type;
		params.network = loadNetwork;

		switch( networkType ) {
			case 'BTC':
				try {
					let createContract = NXAtomicSwapBTC.createAtomicSwapContract(params);
					return createContract;
				} catch(e) {
					console.log('failed to create', e)
					return false;
				}
			break;

			default:
				return false;
			break;
		}
	},

	// decode contract

	decodeAtomicSwapContract: function( currency, contractHex ) {
		if( !currency ) return false;

		let loadNetwork = networks[currency];
		if( ! loadNetwork ) return false;

		let networkType = loadNetwork.type;

		switch( networkType ) {
			case 'BTC':
				try {
					let decodeContract = NXAtomicSwapBTC.decodeAtomicSwapContract({
						script: contractHex,
						network: loadNetwork,
						strings: true
					});
					return decodeContract;
				} catch(e) {
					console.log('failed to decode', e)
					return false;
				}
			break;

			default:
				return false;
			break;
		}
	},

	auditAtomicSwapScript: async function( currency, contract, explorer ) {
		if( !currency ) return false;

		let loadNetwork = networks[currency];
		if( ! loadNetwork ) return false;

		let networkType = loadNetwork.type;

		switch( networkType ) {
			case 'BTC':
				try {
					let auditContract = await NXAtomicSwapBTC.auditAtomicSwapContract({
						script: contract,
						network: loadNetwork,
						explorer: explorer
					});
					return auditContract;
				} catch(e) {
					console.log('failed to audit', e)
					return false;
				}
			break;

			default:
				return false;
			break;
		}
	},

	redeemAtomicSwapContract: async function( currency, contract, secret, explorer, sign ) {
		if( !currency ) return false;

		let loadNetwork = networks[currency];
		if( ! loadNetwork ) return false;

		let networkType = loadNetwork.type;

		switch( networkType ) {
			case 'BTC':
				try {
					let redeemContract = await NXAtomicSwapBTC.redeemAtomicSwap({
						script: contract,
						secret: secret,
						network: loadNetwork,
						explorer: explorer,
						sign: sign
					});
					return redeemContract;
				} catch(e) {
					console.log('failed to redeem', e)
					return false;
				}
			break;

			default:
				return false;
		}
	},

	extractAtomicSwapSecret: async function( currency, contract, explorer ) {
		if( !currency ) return false;

		let loadNetwork = networks[currency];
		if( ! loadNetwork ) return false;

		let networkType = loadNetwork.type;

		switch( networkType ) {
			case 'BTC':
				try {
					let extractSecret = await NXAtomicSwapBTC.extractAtomicSwapSecret({
						script: contract,
						network: loadNetwork,
						explorer: explorer,
					});
					return extractSecret;
				} catch(e) {
					console.log('failed to extract', e)
					return false;
				}
			break;

			default:
				return false;
		}
	}
}