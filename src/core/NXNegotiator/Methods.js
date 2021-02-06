// nxswap-js > NXNegotiator > Methods 
// Methods.js

const crypto = require('crypto');
const { get } = require('store2');
const NXAtomicSwap = require('../NXAtomicSwap/NXAtomicSwap')

module.exports = {

  /**
  * Create New Swap Proposal
  */

  createSwapProposal: function({
    a_currency,
    a_amount,
    a_expires,
    b_pubkey,
    b_currency,
    b_amount
  }) {
    // validate party_b pubkey
    if( ! b_pubkey || b_pubkey.length !== 66 ) return false;
    let party_b_pubkey = Buffer.from(b_pubkey, 'hex');
    if( ! party_b_pubkey || party_b_pubkey.length !== 33 ) {
      return false;
    }

    // validate a & b currencies
    // check the currency is loaded and valid????????
    ////// to do 
    if( ! this.wallet.supportedCurrencies.includes( a_currency ) ||
      ! this.wallet.supportedCurrencies.includes( b_currency )  ) {
        return false;
      }

    // validate a & b amounts
    if( isNaN( a_amount ) || isNaN( b_amount ) || a_amount <= 0 || b_amount <= 0 ) {
      return false;
    }

    // expires?
    if( isNaN( a_expires ) || a_expires <= 0 ) {
      return false;
    }

    // Create proposal..
    let proposal_id = crypto.randomBytes(34).toString('hex');
    let proposal_time = new Date().getTime();
    let proposal_expires = proposal_time + (a_expires * 1000);

    let proposal = {
      id: proposal_id,
      party_a: {
        pubkey: this.wallet.getUserAuthPubKey(),
        currency: a_currency,
        amount: a_amount,
        created: proposal_time,
        expires: proposal_expires,
        cancelled: false,
        address: false,
        contract: false,
        contractBAccepted: false,
        negotiating: false,
        startRequested: false,
        started: false
      },
      party_b: {
        pubkey: b_pubkey.toString('hex'),
        currency: b_currency,
        amount: b_amount,
        received: false,
        address: false,
        contract: false,
        contractAAccepted: false,
        accepted: false,
        declined: false,
        expires: false,
        startAccepted: false
      }
    }

    return proposal;
  },

  sendSwapProposal (proposal) {
    // Add the proposal to the SwapDB..
    let storeProposal = this.nxDB.insertNewProposal({...proposal});
    if( ! storeProposal ) {
      return false;
    }

    let message = this.prepareBroadcastMessage(proposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(proposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  /**
  * Cancel a Swap Proposal
  * This can be performed as a manual action from the user
  * Or automatically for any reason
  */

  cancelSwapProposal: function(id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    // Cancel Swap Proposal
    // An action only available to party_a

    // Can we cancel?
    // We should only cancel if we have not yet received a response from party_b
    if( getProposal.party_b.accepted !== false || getProposal.party_b.declined !== false ) {
      return false;
    }

    // Do it!
    // Only update if we haven't already cancelled

    if( getProposal.party_a.cancelled === false ) {
      let cancelled = new Date().getTime(); 
      getProposal.party_a.cancelled = cancelled;
    
      // Update db..
      let updateProposal = this.nxDB.updateProposal(id, getProposal);
      if( ! updateProposal ) return false;
    }
    
    // rebroadcast anyway..
    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  }, 

  /**
  * Acknowledge A Swap Proposal
  */

 acknowledgeSwapProposal: function(id) {
  let getProposal = this.nxDB.loadProposal(id);
  if( ! getProposal ) return false;

  getProposal = _.cloneDeep(getProposal);

  // Acknowledge Swap Proposal
  // An action only available to party_b, to confirm delivery of proposal

  // Do it!
  let received = new Date().getTime(); 
  getProposal.party_b.received = received;

  // Update db..
  let updateProposal = this.nxDB.updateProposal(id, getProposal);
  if( ! updateProposal ) return false;

  let message = this.prepareBroadcastMessage(getProposal);
  if( ! message) return false;

  let broadcast = this.broadcastMessage(getProposal.party_a.pubkey, message);
  if( ! broadcast ) return false;

  return true;
},

  /**
  * Accept A Swap Proposal
  */

  acceptSwapProposal: function(id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    // Accept Swap Proposal
    // An action only available to party_b

    // Can we accept?
    if( getProposal.party_a.cancelled !== false || getProposal.party_b.accepted !== false || getProposal.party_b.declined !== false ) {
      return false;
    }

    // Do it!
    let accepted = new Date().getTime(); 
    getProposal.party_b.accepted = accepted;

    // New expiry...
    // to complete negotiaitions in the next 10 minutes
    getProposal.party_b.expires = accepted + 600000;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_a.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  /**
  * Decline A Swap Proposal
  */

  declineSwapProposal: function(id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    // Decline Swap Proposal
    // An action only available to party_b
    // party_a should instead use cancelSwapProposal

    // Can we decline?
    if( getProposal.party_b.accepted !== false || getProposal.party_b.declined !== false ) {
      return false;
    }

    // Do it!
    let declined = new Date().getTime(); 
    getProposal.party_b.declined = declined;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_a.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  // Acknowledge Acceptance / Start Negotiations
  acknowledgeAcceptanceStartNegotiations: function (id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    // Acknowledge Swap Proposal Acceptance
    // An action available to party_a

    // party_b must have responded..
    if( getProposal.party_b.accepted === false && getProposal.party_b.declined === false ) {
      return false;
    }

    if( getProposal.party_a.negotiating !== false ) {
      return false;
    }

    // Do it!
    let negotiating = new Date().getTime(); 
    getProposal.party_a.negotiating = negotiating;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  // party_x generate address

  generateAddressForNegotiation: function (id, me_party_a, me_party_b) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( ! me_party_a && ! me_party_b ) return false;
    if( me_party_a && me_party_b ) return false;

    let party = ( me_party_a ) ? getProposal.party_a : getProposal.party_b;
    let currency = (me_party_a) ? getProposal.party_b.currency : getProposal.party_a.currency; // other currency

    // already done?
    if( party.address === false ) {
      // currently we take the next avail address
      // we should reserve it somehow
      // as if you make proposals in fast success, could send the same address to multiple peers
      // not a huge issue, just mah privacy.

      let getNextAddress = this.wallet.getNextAddress(currency, false);
      if( ! getNextAddress ) return false;
      let nextAddress = getNextAddress.nextAddress;

      if( me_party_a ) {
        getProposal.party_a.address = nextAddress;
      } else {
        getProposal.party_b.address = nextAddress;
      }
    }

    // Send it
    let to = false;

    if( me_party_a ) {
      to = getProposal.party_b.pubkey;
    } else {
      to = getProposal.party_a.pubkey;
    }

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;
    
    let broadcast = this.broadcastMessage(to, message);
    if( ! broadcast ) return false;

    return true;
  },

  // party_a create atomic swap contract
  createAtomicSwapContractPartyA: function( id ) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( getProposal.party_a.pubkey !== this.my_pubkey ) return false;
    if( getProposal.party_a.contract !== false ) return false;

    // First need to generate a secret & secret hash for this swap
    // TODO: currently it is stored in plain text in nxDB???
    // not sure where to place it yet.. need to review

    // Check one doesn't exist in the DB? it shouldn't.. then create one
    let loadSecret = this.nxDB.loadSecretPair(id);

    if( loadSecret === false ) {
      let secretPair = NXAtomicSwap.createAtomicSwapSecretPair();

      // Then insert it...
      let insert = this.nxDB.insertSecretPair(id, secretPair);
      if( ! insert ) return false;
      loadSecret = this.nxDB.loadSecretPair(id);
    }

    let secretHash = loadSecret.secretHash;

    // Generate refund address

    let refundAddress = this.wallet.getNextAddress(getProposal.party_a.currency, false);
    if( ! refundAddress ) return false;
    refundAddress = refundAddress.nextAddress;
    
    // Now create the contract....
    let createContract = NXAtomicSwap.createAtomicSwapContract(getProposal.party_a.currency, {
      secretHash: secretHash,
      destination: getProposal.party_b.address,
      refund: refundAddress,
      locktimeHours: 48
    });

    if( ! createContract ) return false;

    let contractHex = createContract.scriptHex;
    getProposal.party_a.contract = contractHex;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;
    
    let broadcast = this.broadcastMessage(getProposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  // party_b create atomic swap contract
  createAtomicSwapContractPartyB: function( id ) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( getProposal.party_b.pubkey !== this.my_pubkey ) return false;
    if( getProposal.party_b.contract !== false ) return false;

    // Ok as party_b we need to extract the secret hash from party_a's contract

    let partyAContract = NXAtomicSwap.decodeAtomicSwapContract(getProposal.party_a.currency, getProposal.party_a.contract);
    if( ! partyAContract ) return false;

    let secretHash = partyAContract.secretHash;
    if( ! secretHash ) return false;

    // Generate refund address
    let refundAddress = this.wallet.getNextAddress(getProposal.party_b.currency, false);
    if( ! refundAddress ) return false;
    refundAddress = refundAddress.nextAddress;
    
    // Now create the contract....
    let createContract = NXAtomicSwap.createAtomicSwapContract(getProposal.party_b.currency, {
      secretHash: secretHash,
      destination: getProposal.party_a.address,
      refund: refundAddress,
      locktimeHours: 24
    });

    if( ! createContract ) return false;

    let contractHex = createContract.scriptHex;
    getProposal.party_b.contract = contractHex;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;
    
    let broadcast = this.broadcastMessage(getProposal.party_a.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  acceptOtherPartiesContract: function(id, me_party_a, me_party_b ) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( ! me_party_a && ! me_party_b ) return false;
    if( me_party_a && me_party_b ) return false;

    // Accept Other parties contract
    // An action available to party_a and party_b

    // Check it's not already been accepted

    let accepted = new Date().getTime(); 
    let to = false;

    if( me_party_a ) {
      if( getProposal.party_a.contractBAccepted !== false ) {
        return false;
      }
      // Accept B Contract
      getProposal.party_a.contractBAccepted = accepted;
      to = getProposal.party_b.pubkey;
    } else if( me_party_b ) {
      if( getProposal.party_b.contractAAccepted !== false ) {
        return false;
      }
      // Accept A contract
      getProposal.party_b.contractAAccepted = accepted;
      to = getProposal.party_a.pubkey;
    }

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(to, message);
    if( ! broadcast ) return false;

    return true;
  },

  // Request Start Swap
  // an action by party_a
  // final handshake

  requestStartSwap: function (id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( getProposal.party_a.startRequested !== false || getProposal.party_a.started !== false ) {
      return false;
    }

    // Do it!
    let now = new Date().getTime(); 
    getProposal.party_a.startRequested = now;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  // Accept Start Swap
  // an action by party_b
  // final handshake

  acceptStartSwap: function (id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( getProposal.party_b.startAccepted !== false ) {
      return false;
    }

    // Do it!
    let now = new Date().getTime(); 
    getProposal.party_b.startAccepted = now;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_a.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  // start Swap
  // an action by party_a
  // final start signal
  // more of a courtesy. just lets b know we have started!

  startSwap: function (id) {
    let getProposal = this.nxDB.loadProposal(id);
    if( ! getProposal ) return false;

    getProposal = _.cloneDeep(getProposal);

    if( getProposal.party_a.started !== false ) {
      return false;
    }

    // Do it!
    let now = new Date().getTime(); 
    getProposal.party_a.started = now;

    // Update db..
    let updateProposal = this.nxDB.updateProposal(id, getProposal);
    if( ! updateProposal ) return false;

    let message = this.prepareBroadcastMessage(getProposal);
    if( ! message) return false;

    let broadcast = this.broadcastMessage(getProposal.party_b.pubkey, message);
    if( ! broadcast ) return false;

    return true;
  },

  /**
  * Prepare Broadcast Proposal
  */

  prepareBroadcastMessage(proposal) {
    let sign = this.signProposalMessage(proposal);
    if( ! sign ) return false;

    let message = {
      proposal: proposal,
      hash: sign.hash,
      sig: sign.signature
    }

    return message;
  },

  // Broadcast Message

  broadcastMessage(to, message) {
    this.msgr.RESTAPIPost('message/send', {
      send: {
        to: to,
        message: message
      }
    });
  },

  /**
  * Delete A Swap Proposal
  */

  deleteSwapProposal: function(id) {
    this.nxDB.deleteProposal(id);
  }
}