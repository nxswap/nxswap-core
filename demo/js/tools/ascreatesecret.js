// nxswap-js
// Toolkit Demo
// Tool > Create Atomic Swap Secret Pair
// Requires demo.js to also be loaded.

let asCreateSecretNetworkA = false;
let asCreateSecretNetworkB = false;

class asCreateSecret extends BaseTool {
  doBindings () {
    this.secretField = $(`#${this.aORb}_tool_ascreatesecret_secret`);
    this.secretHashField = $(`#${this.aORb}_tool_ascreatesecret_secrethash`);

    this.createNewButton = $(`#${this.aORb}_tool_ascreatesecret_createnew`);
    this.createNewButton.bind('click', () => { this.clickCreateNew() });
  }

  clickCreateNew () {
    let { secret, secretHash } = nxswap.createAtomicSwapSecretPair();

    this.secretField.val(secret);
    this.secretHashField.val(secretHash);
  }
}

function createASSecretInit() {
  asCreateSecretNetworkA = new asCreateSecret(true,false);
  asCreateSecretNetworkB = new asCreateSecret(false,true);

  asCreateSecretNetworkA.doBindings();
  asCreateSecretNetworkB.doBindings();
}

$(document).ready( function () {
  createASSecretInit();
});