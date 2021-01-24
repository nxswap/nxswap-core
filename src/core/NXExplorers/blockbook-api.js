const { Blockbook } = require('blockbook-client')

class NXBlockbookExplorer {
	constructor({ node }) {
		this.blockbook = new Blockbook({
			nodes: [node],
			disableTypeValidation: true
		})
	}

	async getAddressDetails(address) {
		var res = false;

		await this.blockbook.getAddressDetails(address).then(function (r) {
			res = r;
		});

		return res;
	}

	async getXpubDetails(xpub, details) {
		var res = false;

		await this.blockbook.getXpubDetails(xpub, details).then(function (r) {
			res = r;
		});

		return res;
	}

	async getUtxosForAddress(address) {
		var res = false;

		await this.blockbook.getUtxosForAddress(address).then(function (r) {
			res = r;
		});

		return res;
	}

	async getTx(tx) {
		var res = false
		await this.blockbook.getTx(tx).then(function (r) {
			res = r;
		});
		return res;
	}

	async getTxSpecific(tx) {
		var res = false
		await this.blockbook.getTxSpecific(tx).then(function (r) {
			res = r;
		});
		return res;
	}

	async sendTx(tx) {
		var txId = false;
		var error = false;

		try {
			txId = await this.blockbook.sendTx(tx);
		} catch(e) {
			error = e;
			txId = false;
		}

		return {
				txId,
				error
		}
	}
}

module.exports = NXBlockbookExplorer;