// nxswap-js
// Toolkit Demo
// Tool > Create Atomic Swap Script
// Requires demo.js to also be loaded.

let asCreateScriptNetworkA = false;
let asCreateScriptNetworkB = false;

class asCreateScript extends BaseTool {
  doBindings () {
    this.secretHash = false;
    this.destAddress = false;
    this.refundAddress = false;
    this.locktimeHours = 48; // Default

    this.canCreateScript = false;

    this.secretHashField = $(`#${this.aORb}_tool_ascreatescript_secrethash`);
    this.secretHashField.bind('keyup', () => { this.onChangeSecretHashField() });

    this.destAddressField = $(`#${this.aORb}_tool_ascreatescript_destaddress`);
    this.destAddressField.bind('keyup', () => { this.onChangeDestAddressField() });

    this.locktimeHoursField = $(`#${this.aORb}_tool_ascreatescript_locktimehrs`);
    this.locktimeHoursField.bind('keyup', () => { this.onChangeLocktimeHoursField() });

    this.createScriptButton = $(`#${this.aORb}_tool_ascreatescript_create`);
    this.createScriptButton.bind('click', () => { this.clickCreateScriptButton() });
  }

  onChangeSecretHashField () {
    this.secretHash = this.secretHashField.val();
    this.checkCanCreateScript();
  }

  onChangeDestAddressField () {
    this.destAddress = this.destAddressField.val();
    this.checkCanCreateScript();
  }

  onChangeLocktimeHoursField () {
    this.locktimeHours = this.locktimeHoursField.val();
    this.checkCanCreateScript();
  }

  checkCanCreateScript () {
    this.canCreateScript = false;
    this.createScriptButton.attr('disabled', true);

    $(`#${this.aORb}_tool_ascreatescript_secrethash_status`).html('').removeClass();
    $(`#${this.aORb}_tool_ascreatescript_destaddress_status`).html('').removeClass();
    $(`#${this.aORb}_tool_ascreatescript_locktimehrs_status`).html('').removeClass();

    if( ! this.secretHash || this.secretHash.length == 0 ) return false;

    // Validate secret hash?
    let validateSecretHash = nxswap.validateSecretHash(this.secretHash);

    if( ! validateSecretHash ) {
      $(`#${this.aORb}_tool_ascreatescript_secrethash_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_ascreatescript_secrethash_status`).html('valid').addClass('green-badge');

    if( ! this.destAddress || this.destAddress.length == 0 ) return false;

    // Validate destination address..
    // this can accept a pubKeyHash or an address..

    let validateDestAddress = nxswap.validatePubKeyHashOrAddress(this.destAddress);

    if( ! validateDestAddress ) {
      $(`#${this.aORb}_tool_ascreatescript_destaddress_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_ascreatescript_destaddress_status`).html('valid').addClass('green-badge');

    if( ! this.locktimeHours ) return false;

    if( ! Number.isInteger( parseInt(this.locktimeHours)) || this.locktimeHours <= 1 ) {
      $(`#${this.aORb}_tool_ascreatescript_locktimehrs_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_ascreatescript_locktimehrs_status`).html('valid').addClass('green-badge');

    // ok..

    this.canCreateScript = true;
    this.createScriptButton.attr('disabled', false);
  }

  clickCreateScriptButton () {
    if( ! this.canCreateScript ) return false;

    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    
    let createScript = nxswap.createAtomicSwapScript( {
      secretHash: this.secretHash,
      destination: this.destAddress,
      refund: (this.isNetworkA) ? addressObjNetworkA.pub : addressObjNetworkB.pub,
      locktimeHours: this.locktimeHours,
      network: network
    });

    if( !createScript ) {
      return false;
    }

    $(`#${this.aORb}_tool_ascreatescript_scripthex`).val(createScript.scriptHex);
    $(`#${this.aORb}_tool_ascreatescript_scriptaddr`).val(createScript.scriptAddress);
  }
}

function createASCreateScriptInit() {
  asCreateScriptNetworkA = new asCreateScript(true,false);
  asCreateScriptNetworkB = new asCreateScript(false,true);

  asCreateScriptNetworkA.doBindings();
  asCreateScriptNetworkB.doBindings();
}

$(document).ready( function () {
  createASCreateScriptInit();
});