// nxswap-core > NXAtomicSwap > NXAtomicSwapBTC
// NXAtomicSwapBTC.js

const bitcoinjs = require('bitcoinjs-lib');
const coinSelect = require('coinselect/split');
const { add, get } = require('store2');

module.exports = {

  // Create BTC Atomic Swap Contract
  createAtomicSwapContract({ 
    secretHash, 
    destination, 
    refund, 
    locktimeHours, 
    type,
    network 
  }) {
		if (!secretHash || !destination || !refund || !network) {
			throw new Error('NOT_ENOUGH_PARAM');
		}

		let destinationPKH = this.extractPKH(destination);
		let refundPKH = this.extractPKH(refund);

		if (!destinationPKH) {
			throw new Error('DEST_PKH_ERROR');
		}

		if (!refundPKH) {
			throw new Error('REFUND_PKH_ERROR');
    }

		if (!locktimeHours) locktimeHours = 48

		// Convert hours to timestamp
		let lockTime = (Date.now() / 1000) + (3600 * locktimeHours);

		let script = bitcoinjs.script.compile([
			bitcoinjs.opcodes.OP_IF,
			bitcoinjs.opcodes.OP_SIZE,
			bitcoinjs.script.number.encode(32),
			bitcoinjs.opcodes.OP_EQUALVERIFY,

			bitcoinjs.opcodes.OP_SHA256,
			Buffer.from(secretHash, 'hex'),
			bitcoinjs.opcodes.OP_EQUALVERIFY,

			bitcoinjs.opcodes.OP_DUP,
			bitcoinjs.opcodes.OP_HASH160,
			Buffer.from(destinationPKH, 'hex'),
			bitcoinjs.opcodes.OP_ELSE,
			bitcoinjs.script.number.encode(lockTime),
			bitcoinjs.opcodes.OP_CHECKLOCKTIMEVERIFY,
			bitcoinjs.opcodes.OP_DROP,

			bitcoinjs.opcodes.OP_DUP,
			bitcoinjs.opcodes.OP_HASH160,
			Buffer.from(refundPKH, 'hex'),
			bitcoinjs.opcodes.OP_ENDIF,
			bitcoinjs.opcodes.OP_EQUALVERIFY,
			bitcoinjs.opcodes.OP_CHECKSIG
    ]);

		let scriptData = false;

		switch (type) {
			default:
			case 'p2wsh':
				scriptData = bitcoinjs.payments.p2wsh({ redeem: { output: script, network: network }, network: network });
				break;

			case 'p2sh':
				scriptData = bitcoinjs.payments.p2sh({ redeem: { output: script, network: network }, network: network });
				break;
		}

		if (!scriptData) {
			throw new Error('CREATE_SCRIPTADDR_FAILED');
		}

		let scriptAddress = scriptData.address;
		let scriptHex = script.toString('hex');

		return {
			scriptAddress,
			scriptHex
		}
  },

  decodeAtomicSwapContract({ script, network, strings }) {
		if (!script || !network) return false;

		let buf = false;
		let decode = false;

		try {
			buf = Buffer.from(script, 'hex');
			decode = bitcoinjs.script.decompile(buf);
		} catch (e) {
			// uh oh
    }
    
		if (!buf || !decode) {
			throw new Error('SCRIPT_DECODE_FAILED');
		}

		// EXTRACT

		let secretHash = decode[5];
		let destinationPKH = decode[9];
		let lockTime = bitcoinjs.script.number.decode(decode[11]);
		let refundPKH = decode[16];

		if (
			(decode[0] == bitcoinjs.opcodes.OP_IF)
			&& (decode[1] == bitcoinjs.opcodes.OP_SIZE)
			&& (bitcoinjs.script.number.decode(decode[2]) == 32)
			&& (decode[3] == bitcoinjs.opcodes.OP_EQUALVERIFY)

			// SECRET HASH SHOULD BE 32 BYTES
			&& (decode[4] == bitcoinjs.opcodes.OP_SHA256)
			&& (secretHash.length == 32)
			&& (decode[6] == bitcoinjs.opcodes.OP_EQUALVERIFY)

			// DESTINATION PKH SHOULD BE 20 BYTES
			&& (decode[7] == bitcoinjs.opcodes.OP_DUP)
			&& (decode[8] == bitcoinjs.opcodes.OP_HASH160)
			&& (destinationPKH.length == 20)
			&& (decode[10] == bitcoinjs.opcodes.OP_ELSE)

			// LOCKTIME SHOULD JUST BE A NUMBER BIGGER THAN 0, WE DON'T JUDGE HERE
			&& (lockTime > 0)
			&& (decode[12] == bitcoinjs.opcodes.OP_CHECKLOCKTIMEVERIFY)
			&& (decode[13] == bitcoinjs.opcodes.OP_DROP)

			// REFUND PKH SHOULD BE 20 BYTES
			&& (decode[14] == bitcoinjs.opcodes.OP_DUP)
			&& (decode[15] == bitcoinjs.opcodes.OP_HASH160)
			&& (refundPKH.length == 20)
			&& (decode[17] == bitcoinjs.opcodes.OP_ENDIF)
			&& (decode[18] == bitcoinjs.opcodes.OP_EQUALVERIFY)
			&& (decode[19] == bitcoinjs.opcodes.OP_CHECKSIG)
		) {

			// Get Script Address
			// Re-compile

			let scriptData = bitcoinjs.payments.p2wsh({ redeem: { output: buf, network: network }, network: network });
			let scriptAddress = scriptData.address;
			let scriptHash = scriptData.hash;

			if (strings) {
				try {
					secretHash = Buffer.from(secretHash, 'hex').toString('hex');
					destinationPKH = Buffer.from(destinationPKH, 'hex').toString('hex');
					refundPKH = Buffer.from(refundPKH, 'hex').toString('hex');
					scriptHash = Buffer.from(scriptHash, 'hex').toString('hex');
				}
				catch (e) {
					throw new Error('STRING_CONVERSION_FAILED');
				}
			}

			return {
				secretHash,
				destinationPKH,
				lockTime,
				refundPKH,
				scriptAddress,
				scriptHash
			}
		} else {
			return false
		}
	},

	// Tool > Audit Atomic Swap Contract
	// Min param: script, explorer & network
	// Optional params can be passed for validation..

	auditAtomicSwapContract: async function({
		script,
		explorer,
		network,
		compareSecretHash,
		expectedAmount,
		expectedDestination,
		lockTimeMinours
	}) {

		if (!script || !explorer || !network) {
			throw new Error('NOT_ENOUGH_PARAM');
		}

		// Validate and extract Script
		//let secretHash, destinationPKH, lockTime, refundPKH, scriptAddress, scriptHash;
		let decodeScript;

		try {
			decodeScript = this.decodeAtomicSwapContract({
				script: script,
				network: network
			});
		} catch (e) {
			throw new Error('SCRIPT_DECODE_FAIL');
		}

		let scriptAddress = decodeScript.scriptAddress;
		let secretHash = decodeScript.secretHash;
		let locktime = decodeScript.lockTime;
		let destinationPKH = decodeScript.destinationPKH;
		let refundPKH = decodeScript.refundPKH;

		// Return params..

		let scriptRedeemed = false;
		let scriptRedeemedTxId = false;
		let scriptValidUtxos = false;
		let scriptUtxoTotal = false;
		let scriptUtxoConfirmedTotal = false;

		// Lookup the script address on the blockchain..
		let addressDetails = await explorer.getAddressDetails(scriptAddress);

		if (!addressDetails) {
			throw new Error('FAILED_TO_GET_ADDR');
		}

		let getUtxos = await explorer.sendWSPromise('getAccountUtxo', {
      descriptor: scriptAddress
		});

		// Get utxos..
		if( ! getUtxos ) return false;

		// Has the script ever been used?
		if (addressDetails.txids && addressDetails.txids.length > 0) {
			let txids = addressDetails.txids;
			// Fetch & Verify each tx..
			for (let txid of txids) {
				let getTx = await explorer.sendWSPromise('getTransaction', {
					txid: txid
				});

				if( ! getTx ) return false;

				let vouts = getTx.vout;
				let txValidOutput = false;

				for (let vout of vouts) {
					let buf = Buffer.from(vout.hex, 'hex')
					let decode = bitcoinjs.script.decompile(buf)

					// P2SH
					if ((decode.length == 3)
						&& (decode[0] == bitcoinjs.opcodes.OP_HASH160)
						&& (Buffer.isBuffer(decode[1]))
						&& (decode[1].length == 20)
						&& (decode[2] == bitcoinjs.opcodes.OP_EQUAL)
					) {

						if (decode[1].equals(decodeScript.scriptHash)) {
							txValidOutput = vout;
							break;
						}
					}
					// P2WSH
					else if (decode.length == 2 && decode[0] == 0) {
						if (decode[1].equals(decodeScript.scriptHash)) {
							txValidOutput = vout;
							break;
						}
					}
				}

				// Does this tx have a valid output?
				if (txValidOutput !== false) {
					// Is this unspent?
					let spentTx = true;
					if (getUtxos.length > 0) {
						for (let utxo of getUtxos) {
							if (utxo.txid == txid) {
								// good.. unspent..
								spentTx = false;
								if (!scriptUtxoTotal) scriptUtxoTotal = 0;
								scriptUtxoTotal += parseInt(utxo.value);
								if( !scriptUtxoConfirmedTotal) scriptUtxoConfirmedTotal = 0;
								// i mean? TODO
								// how are confirmations even logged?
								// testnet bro.. 1  is good
								// LOL LETS DO 0.. too impatient
								if( utxo.confirmations >= 0 ) {
									scriptUtxoConfirmedTotal += parseInt(utxo.value);
								}
								if (!scriptValidUtxos) scriptValidUtxos = [];
								scriptValidUtxos.push({
									txid: txid,
									vout: utxo.vout,
									value: parseInt(utxo.value),
									confirmations: utxo.confirmations
								});
								break; // no need to continue..
							}
						}
					}
					if (spentTx) {
						// Still here? then it's not unspent..
						scriptRedeemed = true;
						scriptRedeemedTxId = txid
					}
				}
			}
		}

		// blockchain audit..
		if (!scriptValidUtxos && !scriptRedeemed) {
			// This script has not been used..
		} else if (scriptValidUtxos && scriptValidUtxos.length > 0 && !scriptRedeemed) {
			// This script has valid utxos.. and has not yet been redeemed..
		} else if (scriptRedeemed) {
			// This script has already been redeemed...
		}

		// script audit..
		let locktimeRemaining = locktime - (Date.now() / 1000);
		let locktimeHoursRemaining = (locktimeRemaining > 0) ? Math.round(locktimeRemaining / 3600) : false;

		//let p2shDestination = bitcoinjs.address.toBase58Check(destinationPKH, network.pubKeyHash);
		let p2wpkhDestination = bitcoinjs.address.toBech32(destinationPKH, 0, network.bech32);
		let p2wpkhRefund = bitcoinjs.address.toBech32(refundPKH, 0, network.bech32);

		// Optional.. Comparison..
		// to do..
		/*
		// Verify Secret Hash
		let expectedSecretHashBuf = Buffer.from(expectedSecretHash, 'hex')

		if (!secretHash.equals(expectedSecretHashBuf)) {
			return false
		}
		*/

		// final formatting..
		secretHash = secretHash.toString('hex');

		return {
			scriptAddress,
			secretHash,
			p2wpkhDestination,
			p2wpkhRefund,
			locktime,
			locktimeHoursRemaining,
			scriptValidUtxos,
			scriptUtxoTotal,
			scriptUtxoConfirmedTotal,
			scriptRedeemed,
			scriptRedeemedTxId
		}
	},
	
	// Tool > Redeem Atomic Swap
	// Fetches utxo from explorer, can sweep multiple utxos from the same contract? not sure why? just yeah..

	redeemAtomicSwap: async function ({ script, secret, explorer, network, feeRate, broadcastTx, sign }) {
		if (!script || !secret || !explorer || !network || !sign) {
			throw new Error('MISSING_PARAMS');
		}

		let { scriptAddress, destinationPKH } = this.decodeAtomicSwapContract({
			script: script,
			network: network
		});

		if (!scriptAddress) {
			throw new Error('INVALID_SCRIPT');
		}

		let p2wpkhDestination = bitcoinjs.address.toBech32(destinationPKH, 0, network.bech32);


		// Get Script Address UTXOs
		let utxos = await this.buildUTXOs(scriptAddress, explorer);

		if (!utxos || utxos.length == 0) {
			throw new Error('SCRIPT_NO_UTXOS');
		}


		let scriptBuf = Buffer.from(script, 'hex');

		// Select Coins

		let destinations = [{ address: p2wpkhDestination }];

		if (!feeRate) {
			if (!network.hasOwnProperty('minimumFeeByte')) {
				throw new Error("FEE_RATE_REQUIRED");
			}

			feeRate = network.minimumFeeByte;
		}

		let { inputs, outputs, fee } = coinSelect(utxos, destinations, feeRate);

		console.log(inputs, outputs, fee );

		let tx = new bitcoinjs.Transaction();

		// Add outputs..

		for (let out of outputs) {
			tx.addOutput(bitcoinjs.address.toOutputScript(out.address, network), out.value);
		}

		for (let inputO in inputs) {
			let input = inputs[inputO];
			let transactionHash = Buffer.from(input.txId, 'hex').reverse();

			let inputPos = tx.addInput(transactionHash, input.vout);
			inputs[inputO].inputPos = inputPos;
		}
		for (let input of inputs) {
			let inputType = input.type;
			let inputPos = input.inputPos;

			let validType = true;
			let signatureHash = false;

			switch (inputType) {
				case 'witness_v0_scripthash':
					signatureHash = tx.hashForWitnessV0(inputPos, scriptBuf, input.value, bitcoinjs.Transaction.SIGHASH_ALL);
					break;

				default:
					//const signatureHash = tx.hashForSignature(0, scriptBuf, bitcoinjs.Transaction.SIGHASH_ALL);
					validType = false;
					break;
			}

			// Input not supported rn
			if (!validType) break;

			// Continue
			let sig = bitcoinjs.script.signature.encode(sign.sign(signatureHash), bitcoinjs.Transaction.SIGHASH_ALL);

			let redeemObject = {
				network: network,
				output: scriptBuf,
				input: bitcoinjs.script.compile([
					sig,
					sign.publicKey,
					Buffer.from(secret.replace(/^0x/, ''), 'hex'),
					bitcoinjs.script.number.encode(1)
				])
			}

			let redeemScriptSig = false;

			switch (inputType) {
				case 'witness_v0_scripthash':
					redeemScriptSig = bitcoinjs.payments.p2wsh({
						network: network,
						redeem: redeemObject
					});
					break;

				default:
					// Not supported rn.. wouldnt get this far
					break;
			}

			tx.setWitness(inputPos, redeemScriptSig.witness);
		}

		let txHex = tx.toHex();
		let txId = false;

		if (broadcastTx) {
			txId = await explorer.sendTx(txHex);
		}

		return {
			txId,
			txHex
		}
	},

	extractAtomicSwapSecret: async function({ script, explorer, network }) {
		if (!script || !explorer || !network) return false;
		let { scriptAddress } = this.decodeAtomicSwapContract({
			script: script,
			network: network
		});

		let scriptBuf;

		try {
			scriptBuf = Buffer.from(script, 'hex');
		} catch (e) {
			scriptBuf = false;
		}

		if (!scriptBuf) {
			throw new Error('SCRIPT_ERROR');
		}

		// get Address Details

		let addressDetails = await explorer.sendWSPromise('getAccountInfo', {
			descriptor: scriptAddress,
      page: 1,
      pageSize: 1000,
    	details: 'txids',
      tokens: 'used',
		});

		if (!addressDetails) {
			throw new Error('FAILED_ADRR');
		}

		console.log('addressDetails', addressDetails)

		// Has the script ever been used?

		if (!addressDetails.txids || addressDetails.txids == 0) {
			throw new Error('SCRIPT_UNUSED_NO_UTXO');
		}

		// Look for redemption?

		let scriptTxs = addressDetails.txids;

		if (!scriptTxs || scriptTxs.length == 0) return false; //?

		var redemptionFound = false
		var redemptionTxId = false
		var extractedSecret = false

		for (let txId of scriptTxs) {
			let getTx = await explorer.sendWSPromise('getTransactionSpecific', {
				txid: txId
			});

			if( !getTx) return false;

			let txInputs = getTx.vin;

			if (redemptionFound) {
				break;
			}

			for (let input of txInputs) {
				if (input.scriptSig.hex.length > 0) {
					// decode hex of script..					
					let scriptSigBuf = Buffer.from(input.scriptSig.hex, 'hex')
					let decode = bitcoinjs.script.decompile(scriptSigBuf);

					if (decode.length == 5) {
						let origScript = decode[4]

						if (origScript.equals(scriptBuf)) {
							// We have a match..
							// Extract the secret..
							redemptionFound = true;
							redemptionTxId = txId;
							extractedSecret = decode[2].toString('hex');
							break;
						}
					}
				}
				else {
					// P2WSH
					let txInWitness = input.txinwitness;
					if (txInWitness.length == 5) {
						let bufferScriptInTx = Buffer.from(txInWitness[4], 'hex');
						let possSecretBuffer = Buffer.from(txInWitness[2], 'hex');

						if (bufferScriptInTx.equals(scriptBuf) && possSecretBuffer.length == 32) {
							// We have a P2WSH match..
							redemptionFound = true;
							redemptionTxId = txId;
							extractedSecret = possSecretBuffer.toString('hex');
							break;
						}
					}
				}
			}
		}

		if (!redemptionFound) {
			throw new Error('SCRIPT_NOT_YET_REDEEMED');
		}

		return {
			redemptionTxId,
			extractedSecret
		}
	},

  // Extract PKH
	// Accepts an address string, or a PKH as a string and in both instances, returns a PKH buffer..

	extractPKH: function(string) {
		let validate = this.validatePubKeyHashOrAddress(string);

		if (!validate) {
			return false;
		}

		let buf = false;
		let address = false;

		try {
			buf = Buffer.from(string, 'hex');
		} catch (e) {
			buf = false;
		}

		if (!buf || buf.length != 20) {
			try {
				address = this.addressToPubKeyHash(string);
			} catch (e) {
				address = false;
			}

			if (!address) {
				return false;
			}

			if (address.PKH.length == 20) {
				buf = address.PKH;
			}
		}

		if (!buf || buf.length != 20) {
			return false;
		}

		return buf;
  },

  addressToPubKeyHash(address) {
		var decode = false;
		var PKH = false;

		try {
			decode = bitcoinjs.address.fromBase58Check(address)
			PKH = decode.hash
		}
		catch (e) { }

		if (!PKH) {
			try {
				decode = bitcoinjs.address.fromBech32(address)
				PKH = decode.data
			}
			catch (e) { }
		}

		if (!PKH) return false;

		let buf = Buffer.from(PKH, 'hex');
		let pkhHex = buf.toString('hex');

		return {
			PKH,
			pkhHex
		}
	},
  
  // Accepts an address or a pub key hash for validation
	// trys to convert the address to a PKH

	validatePubKeyHashOrAddress: function(string) {
		let buf = false;
		let address = false;

		try {
			address = this.addressToPubKeyHash(string);
		}
		catch (e) { }

		// Create buffer..
		try {
			if (!address) {
				buf = Buffer.from(string, 'hex');
			} else {
				buf = Buffer.from(address.PKH, 'hex');
			}
		} catch (e) {
			// no buf?
			// Not an address, or a valid PKH
			return false;
		}

		// valid PKH?
		if (!buf || buf.length != 20) return false;
		return true;
	},

	// buildUTXOS?
	// used by redeem? old code from concept
	// TODO

	buildUTXOs: async function(address, explorer) {

		let getUtxos = await explorer.sendWSPromise('getAccountUtxo', {
      descriptor: address
		});
		if (getUtxos.length == 0) return [];

		var utxos = [];

		for (let utxo of getUtxos) {
			let getTx = await explorer.sendWSPromise('getTransactionSpecific', {
				txid: utxo.txid
			});
			if( ! getTx ) return false;

			let txHex = getTx.hex;

			// get full vout index..
			let txVouts = getTx.vout;
			let vout;
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
				value: parseInt(utxo.value),
			}

			// Switch type..
			switch (vout.scriptPubKey.type) {
				case 'witness_v0_keyhash':
				case 'witness_v0_scripthash':
					utxoObject.witnessUtxo = {
						script: Buffer.from(vout.scriptPubKey.hex, 'hex'),
						value: parseInt(utxo.value)
					}
					break;

				default:
					//nonWitnessUtxo: Buffer.from(txHex, 'hex')
					console.log('unsupported input.. type:' + vout.scriptPubKey.type);
					break;
					break;
			}

			utxoObject.type = vout.scriptPubKey.type;
			utxos.push(utxoObject);
		}

		return utxos
	}
}