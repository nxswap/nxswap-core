// nxswap-js
// networks.js

module.exports = {
	// Bitcoin
	BTC: {
		type: 'BTC',
		messagePrefix: '\x18Bitcoin Signed Message:\n',
		bech32: 'bc',
		bip32: {
			public: 0x0488b21e,
			private: 0x0488ade4,
		},
		bip84: {
			public: 0x04b24746,
			private: 0x04b2430c
		},
		pubKeyHash: 0x00,
		scriptHash: 0x05,
		wif: 0x80,
		testnet: false
	},
	TBTC: {
		type: 'BTC',
		messagePrefix: '\x18Bitcoin Signed Message:\n',
		bech32: 'tb',
		bip32: {
			public: 0x043587cf,
			private: 0x04358394,
		},
		bip84: {
			public: 0x045f1cf6,
			private: 0x045f18bc
		},
		pubKeyHash: 0x6f,
		scriptHash: 0xc4,
		wif: 0xef,
		testnet: true,
		defaultBlockbook: 'https://tbtc.blockbook.nxswap.com',
		minimumFeeByte: 10
	},
	// Litecoin
	LTC: {
		type: 'BTC',
		messagePrefix: '\x19Litecoin Signed Message:\n',
		bech32: 'ltc',
		bip32: {
			public: 0x019da462,
			private: 0x019d9cfe,
		},
		pubKeyHash: 0x30,
		scriptHash: 0x32,
		wif: 0xb0,
		testnet: false
	},
	TLTC: {
		type: 'BTC',
		messagePrefix: '\x19Litecoin Signed Message:\n',
		bech32: 'tltc',
		bip32: {
			public: 0x043587cf,
			private: 0x04358394,
		},
		pubKeyHash: 0x6f,
		scriptHash: 0x3a,
		wif: 0xef,
		testnet: true,
		defaultBlockbook: 'https://tltc.blockbook.nxswap.com',
		minimumFeeByte: 10
	},
	// Vertcoin
	VTC: {
		type: 'BTC',
		messagePrefix: '\x19Vertcoin Signed Message:\n',
		bech32: 'vtc',
		bip32: {
			public: 0x0488b212,
			private: 0x0488ade4, 
		},
		bip84: {
			public: 0x04b24746,
			private: 0x04b2430c
		},
		pubKeyHash: 0x47,
		scriptHash: 0x05,
		wif: 0x80,
		testnet: false
	},
	TVTC: {
		type: 'BTC',
		messagePrefix: 'Vertcoin Signed Message:\n',
		bech32: 'tvtc',
		bip32: {
			public: 0x043587cf,
			private: 0x04358394,
		},
		bip84: {
			public: 0x045f1cf6,
			private: 0x045f18bc
		},
		pubKeyHash: 0x4a,
		scriptHash: 0xc4,
		wif: 0xef,
		testnet: true,
		defaultBlockbook: 'https://tvtc.blockbook.nxswap.com',
		minimumFeeByte: 100
	},
	TGRS: {
		type: 'BTC',
		messagePrefix: 'Groestlcoin Signed Message:\n',
		bech32: 'tgrs',
		bip32: {
			public: 0x043587cf,
			private: 0x04358394,
		},
		bip84: {
			public: 0x045f1cf6,
			private: 0x045f18bc
		},
		pubKeyHash: 0x6f,
		scriptHash: 0xc4,
		wif: 0xef,
		testnet: true,
		defaultBlockbook: 'https://tgrs.blockbook.nxswap.com',
		minimumFeeByte: 100
	},
	DGBT: {
		type: 'BTC',
		messagePrefix: 'DigiByte Signed Message:\n',
		bech32: 'dgbt',
		bip32: {
			public: 0x043587cf,
			private: 0x04358394,
		},
		bip84: {
			public: 0x045f1cf6,
			private: 0x045f18bc
		},
		pubKeyHash: 0x7e,
		scriptHash: 0x8c,
		wif: 0xfe,
		testnet: true,
		defaultBlockbook: 'https://dgbt.blockbook.nxswap.com',
		minimumFeeByte: 1
	}
};