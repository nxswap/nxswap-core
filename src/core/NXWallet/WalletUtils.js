// nxswap-core > NXWallet > WalletUtils 
// WalletUtils.js

const networks = require('../../networks');

module.exports = {

  returnMaxSwapAmount: function(currency) {
    let network = networks[currency];
    if (!currency || network == undefined) return false;

    // Get max amount..
    // TO DO
    // THIS SHOULD TAKE INTO ACCOUNT LOCKED UTXOS, IE ALREADY IN SWAP
    // PLUS NUMBER OF INPUTS
    // PLUS FEES

    // for now, max - fee per kb.. hacky hax
    let max = ( this.balancesAvailable[currency] - (network.minimumFeeByte * 1000) ) / 100000000;
    return max;
  }
}