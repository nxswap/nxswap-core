// nxswap-js
// Toolkit Demo
// Tool > Redeem Atomic Swap Script
// Requires demo.js to also be loaded.

let asRedeemScriptNetworkA = false;
let asRedeemScriptNetworkB = false;

class asRedeemScript extends BaseTool {
  doBindings () {
    this.scriptHex = false;
    this.secret = false;
    this.txRaw = false;

    this.canCreateTransaction = false;
    this.canBroadcastTransaction = false;

    this.creatingTX = false;
    this.broadcastingTX = false;

    this.scriptHexField = $(`#${this.aORb}_tool_asredeemscript_scripthex`);
    this.scriptHexField.bind('keyup', () => { this.onChangeScriptHexField() });

    this.secretField = $(`#${this.aORb}_tool_asredeemscript_secret`);
    this.secretField.bind('keyup', () => { this.onChangeSecretField() });

    this.createTransactionButton = $(`#${this.aORb}_tool_asredeemscript_create`);
    this.createTransactionButton.bind('click', () => { this.clickCreateTransaction() });

    this.txRawField = $(`#${this.aORb}_tool_asredeemscript_txraw`);
    this.txRawField.bind('keyup', () => { this.onChangeTxRawField() });

    this.broadcastTransactionButton = $(`#${this.aORb}_tool_asredeemscript_broadcast`);  
    this.broadcastTransactionButton.bind('click', () => { this.clickBroadcastTransaction() });
  }

  onChangeScriptHexField () {
    this.scriptHex = this.scriptHexField.val();
    this.checkCanCreateTransaction();
  }

  onChangeSecretField () {
    this.secret = this.secretField.val();
    this.checkCanCreateTransaction();
  }

  onChangeTxRawField () {
    this.txRaw = this.txRawField.val();
    this.checkCanBroadcastTX();
  }

  checkCanCreateTransaction () {
    if( this.creatingTX ) return false;
    
    this.canCreateTransaction = false;
    this.createTransactionButton.attr('disabled', true);

    $(`#${this.aORb}_tool_asredeemscript_scripthex_status`).html('').removeClass();
    $(`#${this.aORb}_tool_asredeemscript_secret_status`).html('').removeClass();

    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    let decodeScript = false;

    if( ! this.scriptHex || this.scriptHex.length == 0 ) return false;

    // Decode script..

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
      $(`#${this.aORb}_tool_asredeemscript_scripthex_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_asredeemscript_scripthex_status`).html('valid').addClass('green-badge');

    // Check Secret..

    if( ! this.secret || this.secret.length == 0 ) return false;

    let expectedSecretHash = decodeScript.secretHash;
    let hashSecret = nxswap.returnSecretHash(this.secret);

    if( hashSecret != expectedSecretHash ) {
      $(`#${this.aORb}_tool_asredeemscript_secret_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_asredeemscript_secret_status`).html('valid').addClass('green-badge');

    this.canCreateTransaction = true;
    this.createTransactionButton.attr('disabled', false);
  }

  checkCanBroadcastTX () {
    if( this.broadcastingTX ) return false;

    this.canBroadcastTX = false;
    this.broadcastTransactionButton.attr('disabled', true);

    if( ! this.txRaw || this.txRaw.length == 0 ) return false;

    // Not sure what else to check yet.. to-do..

    this.canBroadcastTX = true;
    this.broadcastTransactionButton.attr('disabled', false);
  }

  async clickCreateTransaction () {
    if( !this.canCreateTransaction ) return false;
    if( this.creatingTX ) return false;

    $(`#${this.aORb}_tool_asredeemscript`).addClass('disabledForm');
    $(`#${this.aORb}_simpletx_createbroadcast_result`).hide().html('').removeClass();

    let redeemAtomicSwap = false;
    let redeemError = false;

    let addressObj = (this.isNetworkA) ? addressObjNetworkA : addressObjNetworkB;
    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;
    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    
    try {
      redeemAtomicSwap = await nxswap.redeemAtomicSwap({
        script: this.scriptHex,
        secret: this.secret,
        destinationAddressObject: addressObj,
        blockbookInstance: blockbook,
        network: network,
        broadcastTx: false
      });
    } catch(e) {
      // bad!
      redeemError = e.message;
    }  

    $(`#${this.aORb}_tool_asredeemscript`).removeClass('disabledForm');
    this.creatingTX = false;

    if( ! redeemAtomicSwap ) {
      $(`#${this.aORb}_tool_asredeemscript_result`).html(`create tx failed.. ${redeemError}`).show().addClass('red-alert');
      return false;
    }

    $(`#${this.aORb}_simpletx_createbroadcast_result`).hide().html('').removeClass();

    let txHex = redeemAtomicSwap.txHex;
    this.txRawField.val(txHex);
    this.onChangeTxRawField();
  }

  async clickBroadcastTransaction () {
    if( ! this.canBroadcastTX ) return false;
    if( this.broadcastingTX ) return false;

    this.broadcastingTX = true;
    this.broadcastTransactionButton.attr('disabled', true);
    
    $(`#${this.aORb}_tool_asredeemscript_result`).hide().html('').removeClass();

    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;

    let { txId, error } = await blockbook.sendTx(this.txRaw);

    this.broadcastingTX = false;
    this.broadcastTransactionButton.attr('disabled', false);

    if( ! txId ) {
      $(`#${this.aORb}_tool_asredeemscript_result`).html(`broadcast failed<br />${error}`).show().addClass('red-alert');
      return false;
    }

    $(`#${this.aORb}_tool_asredeemscript_result`).html(`Success txid:<br />${txId}`).show().addClass('green-alert');
  }
}

function createASRedeemScriptInit() {
  asRedeemScriptNetworkA = new asRedeemScript(true,false);
  asRedeemScriptNetworkB = new asRedeemScript(false,true);

  asRedeemScriptNetworkA.doBindings();
  asRedeemScriptNetworkB.doBindings();
}

$(document).ready( function () {
  createASRedeemScriptInit();
});