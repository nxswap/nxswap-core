// nxswap-core > NXAtomicSwapUtil 
// NXAtomicSwapUtil.js

const crypto = require('crypto');
const cryptoRandomString = require('crypto-random-string');

module.exports = {

  // Return Secret

  returnSecret: function(length) {
		return cryptoRandomString({ length: length });
	},

  // Return Secret Hash
	returnSecretHash: function(secret) {
		let buf = false;

		try {
			buf = Buffer.from(secret, 'hex')
		} catch (e) {}

    if (!buf) return false;
    
    let hash = crypto.createHash('sha256').update(buf).digest('hex');
		return hash;
	}
}
