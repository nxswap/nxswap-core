// nxswap-js
// Toolkit Demo
// Tool > Extract Atomic Swap Secret
// Requires demo.js to also be loaded.

let asExtractSecretNetworkA = false;
let asExtractSecretNetworkB = false;

class asExtractSecret extends BaseTool {
  doBindings () {
    this.scriptHex = false;

    this.canExtractSecret = false;
    this.extractingSecret = false;

    this.scriptHexField = $(`#${this.aORb}_tool_asextractsecret_scripthex`);
    this.scriptHexField.bind('keyup', () => { this.onChangeScriptHexField() });

    this.extractSecretButton = $(`#${this.aORb}_tool_asextractsecret_extract`);
    this.extractSecretButton.bind('click', () => { this.clickExtractSecretButton() });
  }

  onChangeScriptHexField () {
    this.scriptHex = this.scriptHexField.val();
    this.checkCanExtractSecret();
  }

  checkCanExtractSecret () {
    this.canExtractSecret = false;
    this.extractSecretButton.attr('disabled', true);

    $(`#${this.aORb}_tool_asextractsecret_scripthex_status`).html('').removeClass();

    if( ! this.scriptHex || this.scriptHex.length == 0 ) return false;

    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    let decodeScript = false;

    try {
      decodeScript = nxswap.decodeAtomicSwapScript({
        script: this.scriptHex,
        network: network,
        strings: true
      });
    } catch(e) {
      // nope..
    }

    if( ! decodeScript ) {
      $(`#${this.aORb}_tool_asextractsecret_scripthex_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_asextractsecret_scripthex_status`).html('valid').addClass('green-badge');

    this.canExtractSecret = true;
    this.extractSecretButton.attr('disabled', false);
  }

  async clickExtractSecretButton () {
    if( this.extractingSecret || !this.canExtractSecret ) return false;

    this.extractingSecret = true;
    $(`#${this.aORb}_tool_asextractsecret`).addClass('disabledForm');
    $(`#${this.aORb}_tool_asextractsecret_extract_status`).html('').removeClass();

    this.extractSecretButton.attr('disabled', true);

    // Extract...

    let extractSecret;
    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;
    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    let extractError;

    try {
      extractSecret = await nxswap.extractAtomicSwapSecret({
        script: this.scriptHex,
        blockbookInstance: blockbook,
        network: network
      });
    }
    catch(e) {
      extractError = e.message;
    }

    $(`#${this.aORb}_tool_asextractsecret`).removeClass('disabledForm');
    this.extractSecretButton.attr('disabled', false);
    this.extractingSecret = false;

    if( ! extractSecret ) {
      $(`#${this.aORb}_tool_asextractsecret_extract_status`).html(`failed ${extractError}`).addClass('red-badge');
      return false;
    }

    // Ok good..

    $(`#${this.aORb}_tool_asextractsecret_secret`).val(extractSecret.extractedSecret);
    $(`#${this.aORb}_tool_asextractsecret_txid`).val(extractSecret.redemptionTxId);

    $(`#${this.aORb}_tool_asextractsecret_extract_status`).html('success').addClass('green-badge');
  }
}

function ASExtractSecretInit() {
  asExtractSecretNetworkA = new asExtractSecret(true,false);
  asExtractSecretNetworkB = new asExtractSecret(false,true);

  asExtractSecretNetworkA.doBindings();
  asExtractSecretNetworkB.doBindings();
}

$(document).ready( function () {
  ASExtractSecretInit();
});