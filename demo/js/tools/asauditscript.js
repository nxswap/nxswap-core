// nxswap-js
// Toolkit Demo
// Tool > Audit Atomic Swap Script
// Requires demo.js to also be loaded.

let asAuditScriptNetworkA = false;
let asAuditScriptNetworkB = false;

class asAuditScript extends BaseTool {
  doBindings() {
    this.scriptHex = false;
    this.canAuditScript = false;
    this.auditingScript = false;

    this.scriptHexField = $(`#${this.aORb}_tool_asauditscript_scripthex`);
    this.scriptHexField.bind('keyup', () => { this.onChangeScriptHexField() });

    this.auditScriptButton = $(`#${this.aORb}_tool_asauditscript_audit`);
    this.auditScriptButton.bind('click', () => { this.clickAuditScriptButton() });
  }

  onChangeScriptHexField() {
    this.scriptHex = this.scriptHexField.val();
    this.checkCanAuditScript();
  }

  checkCanAuditScript() {
    if (this.auditingScript) return false;

    this.canAuditScript = false;
    this.auditScriptButton.attr('disabled', true);

    $(`#${this.aORb}_tool_asauditscript_audit_status`).html('').removeClass();

    if (!this.scriptHex || this.scriptHex.length == 0) return false;

    this.canAuditScript = true;
    this.auditScriptButton.attr('disabled', false);
  }

  async clickAuditScriptButton() {
    if (!this.canAuditScript) return false;
    if (this.auditingScript) return false;

    let network = (this.isNetworkA) ? nxswap.networks[currentNetworkA] : nxswap.networks[currentNetworkB];
    let blockbook = (this.isNetworkA) ? blockbookNetworkA : blockbookNetworkB;
    let auditScript = false;

    $(`#${this.aORb}_tool_asauditscript_blockchainaudit`).html('').removeClass();
    $(`#${this.aORb}_tool_asauditscript_utxos`).hide();
    $(`#${this.aORb}_tool_asauditscript_utxos table tbody tr`).remove();

    try {
      auditScript = await nxswap.auditAtomicSwapScript({
        script: this.scriptHex,
        explorer: blockbook,
        network: network
      });
    } catch(e) {
      // error!
      auditScript = false;
    }

    if( ! auditScript ) {
      $(`#${this.aORb}_tool_asauditscript_audit_status`).html('invalid').addClass('red-badge');
      return false;
    }

    $(`#${this.aORb}_tool_asauditscript_audit_status`).html('success').addClass('green-badge');

    $(`#${this.aORb}_tool_asauditscript_scriptaddr`).val(auditScript.scriptAddress);
    $(`#${this.aORb}_tool_asauditscript_secrethash`).val(auditScript.secretHash);
    $(`#${this.aORb}_tool_asauditscript_destp2wpkh`).val(auditScript.p2wpkhDestination);
    $(`#${this.aORb}_tool_asauditscript_refundp2wpkh`).val(auditScript.p2wpkhRefund);

    let hours = (auditScript.locktimeHoursRemaining > 0 ) ? `${auditScript.locktimeHoursRemaining} Hours Remaining` : 'Bad Locktime! <0 Hours Remaining';

    $(`#${this.aORb}_tool_asauditscript_locktime`).val(`${auditScript.locktime} - ${hours}`);

    // Blockchain audit...

    if( ! auditScript.scriptValidUtxos && ! auditScript.scriptRedeemed ) {
      // Not yet used
      $(`#${this.aORb}_tool_asauditscript_blockchainaudit`).html('This script has no valid utxos').addClass('red-badge');
    } else if( auditScript.scriptValidUtxos.length > 0 ) {
      // valid utxos
      $(`#${this.aORb}_tool_asauditscript_blockchainaudit`).html(`This script has valid utxo(s) totalling ${auditScript.scriptUtxoTotal} (see below)`).addClass('green-badge');
      
      for( let pos in auditScript.scriptValidUtxos) {
        let utxo = auditScript.scriptValidUtxos[pos];
        $(`#${this.aORb}_tool_asauditscript_utxos table tbody`).append(`<tr><td>${utxo.txid}</td><td>${utxo.value}</td><td>${utxo.confirmations}</td></tr>`);
      }
      $(`#${this.aORb}_tool_asauditscript_utxos`).show();
    } else if( auditScript.scriptRedeemed ) {
      $(`#${this.aORb}_tool_asauditscript_blockchainaudit`).html(`This script has already been redeemed!`).addClass('red-badge');
    }
  }
}

function ASAuditScriptInit() {
  asAuditScriptNetworkA = new asAuditScript(true, false);
  asAuditScriptNetworkB = new asAuditScript(false, true);

  asAuditScriptNetworkA.doBindings();
  asAuditScriptNetworkB.doBindings();
}

$(document).ready(function () {
  ASAuditScriptInit();
});