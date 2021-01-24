// nxswap-js
// Toolkit Demo
// Tool > Create & Broadcast Simple Transaction
// Requires demo.js to also be loaded.

let simpleTXNetworkA = false;
let simpleTXNetworkB = false;

class toolSimpleTX extends BaseTool {
  doBindings () {
    this.toAddress = false;
    this.amount = false;
    this.txRaw = false;

    this.canCreateTX = false;
    this.creatingTX = false;
    this.canBroadcastTX = false;
    this.broadcastingTX = false;

    this.toAddressField = $(`#${this.aORb}_simpletx_toaddress`);
    this.toAddressField.bind('keyup', () => { this.onChangeAddressField() });

    this.amountField = $(`#${this.aORb}_simpletx_amount`);
    this.amountField.bind('keyup', () => { this.onChangeAmountField() });

    $(`#${this.aORb}_simpletx_amount_max`).bind('click', () => { this.clickMaxAmount() })

    this.txRawField = $(`#${this.aORb}_simpletx_txraw`);
    this.txRawField.bind('keyup', () => { this.onChangeTxRawField() });

    this.createTransactionButton = $(`#${this.aORb}_simpletx_create`);
    this.createTransactionButton.bind('click', () => { this.clickCreateTransaction() });

    this.broadcastTransactionButton = $(`#${this.aORb}_simpletx_broadcast`);  
    this.broadcastTransactionButton.bind('click', () => { this.clickBroadcastTransaction() });
  }

  onChangeAddressField () {
    this.toAddress = this.toAddressField.val();
    this.checkCanCreateTX();
  }

  onChangeAmountField () {
    this.amount = parseInt(this.amountField.val());
    this.checkCanCreateTX();
  }

  clickMaxAmount () {
    this.amountField.val()
  }

  onChangeTxRawField () {
    this.txRaw = this.txRawField.val();
    this.checkCanBroadcastTX();
  }

  async clickCreateTransaction () {
    if( ! this.canCreateTX ) return false;
    this.creatingTX = true;
    $(`#${this.aORb}_simpletx_createbroadcast_result`).hide().html('').removeClass();
    $(`#${this.aORb}_tool_simpletx`).addClass('disabledForm');
    
    let addressObj = (this.isNetworkA) ? addressObjNetworkA : addressObjNetworkB;
    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;
    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];

    let amount = (this.amount > 0 ) ? parseInt(this.amount) : false; 

    let createTransaction;
    let createTransactionError;
    
    try {
      createTransaction = await nxswap.createSimpleTransaction({
        addressObject: addressObj,
        toAddress: this.toAddress,
        amount: amount,
        network: network,
        blockbookInstance: blockbook,
        feeRate: false,
        broadcastTX: false
      });
    }
    catch(e) {
      createTransaction = false;
      createTransactionError = e.message;
    }

    $(`#${this.aORb}_tool_simpletx`).removeClass('disabledForm');
    this.creatingTX = false;

    if( ! createTransaction ) {
      $(`#${this.aORb}_simpletx_createbroadcast_result`).html(`create tx failed.. ${createTransactionError}`).show().addClass('red-alert');
      return false;
    }

    $(`#${this.aORb}_simpletx_createbroadcast_result`).hide().html('').removeClass();

    let txRawHex = createTransaction.txRawHex;
    this.txRawField.val(txRawHex);
    this.onChangeTxRawField();
    this.checkCanBroadcastTX();    
  }

  async clickBroadcastTransaction () {
    if( ! this.canBroadcastTX ) return false;

    this.broadcastingTX = true;
    
    $(`#${this.aORb}_simpletx_createbroadcast_result`).hide().html('').removeClass();

    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;

    let { txId, error } = await blockbook.sendTx(this.txRaw);

    this.broadcastingTX = false;

    if( ! txId ) {
      $(`#${this.aORb}_simpletx_createbroadcast_result`).html(`broadcast failed<br />${error}`).show().addClass('red-alert');
      return false;
    }

    $(`#${this.aORb}_simpletx_createbroadcast_result`).html(`Success txid:<br />${txId}`).show().addClass('green-alert');
  }

  checkCanCreateTX () {
    if( this.creatingTX ) {
      return false;
    }

    this.canCreateTX = false;
    this.createTransactionButton.attr('disabled', true);

    $(`#${this.aORb}_simpletx_address_status`).html('').removeClass();
    $(`#${this.aORb}_simpletx_amount_status`).html('').removeClass();

    if( ! this.toAddress || this.toAddress.length == 0 ) return false;

    // Validate address..

    let network = (this.isNetworkA) ? currentNetworkA : currentNetworkB;
    let validateAddress = nxswap.validateCryptoAddress( this.toAddress, nxswap.networks[network] );

    if( ! validateAddress ) {
      $(`#${this.aORb}_simpletx_address_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_simpletx_address_status`).html('valid').addClass('green-badge');

    let currentNetworkBalance = (this.isNetworkA) ? addressNetworkABalance : addressNetworkBBalance;

    // Check amount...

    if( ( ! currentNetworkBalance || currentNetworkBalance == 0 ) || ( this.amount > 0 && currentNetworkBalance < this.amount ) ) {
      $(`#${this.aORb}_simpletx_amount_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_simpletx_amount_status`).html('valid').addClass('green-badge');

    // Can create..
    this.canCreateTX = true;
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
}

function simpleTXInit() {
  simpleTXNetworkA = new toolSimpleTX(true,false);
  simpleTXNetworkB = new toolSimpleTX(false,true);

  simpleTXNetworkA.doBindings();
  simpleTXNetworkB.doBindings();
}

$(document).ready( function () {
  simpleTXInit();
});