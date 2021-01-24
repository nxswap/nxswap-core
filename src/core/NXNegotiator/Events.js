// nxswap-js > NXNegotiator > Events 
// Events.js

module.exports = {
  // Handle incoming peer message
  handleIncomingPeerMessage( message ) {
    // is the message a proposal?
    if( 'proposal' in message ) {
      this.handleIncomingPeerProposal(message);
      return;
    }

    console.log('unknown message', message );
  },

  // handle incoming peer proposal
  
  handleIncomingPeerProposal (message) {
    // Verify the message is a valid proposal message structure
    // Verify the proposal is a valid structure
    // Verify the signature of the proposal

    // get local pubkey
    let my_pubkey = this.wallet.getUserAuthPubKey();

    if( ! this.isValidProposalMessageStructure(message, my_pubkey) ) return false;

    // Extract the proposal ID
    let proposal = message.proposal;
    let hash = message.hash;
    let proposal_id = proposal.id;
    let party_a = proposal.party_a;
    let party_b = proposal.party_b;

    let me_party_a = ( party_a.pubkey === my_pubkey );
    let me_party_b = ( party_b.pubkey === my_pubkey );

    // Verify that we are a part of this proposal..
    if( ! me_party_a && ! me_party_b || me_party_a && me_party_b ) return false;

    // Is this proposal known to us already?
    let knownProposal = this.nxDB.doesProposalExist(proposal_id);

    if( ! knownProposal ) {
      // Am I party a? if i am.. you fooling me. you can't create my own proposals fool!
      if( me_party_a ) return false;
      let now = new Date().getTime();
      // Check it hasn't expired?
      if( now >= proposal.party_a.expires ) return false;
      // Update received
      // maybe delivery notification? for now it's messing with the tamper
      //proposal.party_b.received = now;
      // insert into local database...
      this.nxDB.insertNewProposal(proposal);
    } else {
      // Known proposal..
      // Verify differences in proposal...

      let loadKnown = this.nxDB.loadProposal(proposal_id);
      if( ! loadKnown) return false;

      let hashKnown = this.hashProposal(loadKnown);

      // Ignore unchanged proposal, possible re-broadcast
      if( hashKnown == hash ) {
        console.log('proposal unchanged. ignore repeat message!');
        return false;
      }

      console.log('known and changed!!!', proposal);

      let party_a_diff = this.getProposalDifferences(loadKnown.party_a, proposal.party_a);
      let party_b_diff = this.getProposalDifferences(loadKnown.party_b, proposal.party_b);

      // The other party can not mess with parameters in the other parties section of the proposal object
      
      if( me_party_a ) {
        if( party_a_diff !== false ) {
          // don't tamper with my shit!
          console.log('dont tamper with party a!!')
          return false;
        }

        console.log('me a')

        console.log('a diff', party_b_diff);
        if( party_b_diff === false ) return false;

        // Process party_b changes
        this.handleProposalChangesPartyB(proposal_id, party_b_diff, loadKnown.party_b, proposal.party_b, loadKnown.party_a)
        
      } else if( me_party_b ) {
        if( party_b_diff !== false ) {
          console.log('dont tamper with party b!!')
          return false;
        }
        console.log('me b')

        console.log('b diff', party_a_diff);
        if( party_a_diff === false ) return false;

        // process party_a changes
        this.handleProposalChangesPartyA(proposal_id, party_a_diff, loadKnown.party_a, proposal.party_a, loadKnown.party_b)
      }
    }

    return true;
  },

  // Handle any changes on party_a
  // Only certain elements are acceptable to change

  handleProposalChangesPartyA (id, diff, known, rxa, known_b) {
    console.log('handling party_a changes', diff);
    if( ! diff ) return false;

    let tamper = false;
    let approvedChanges = {};

    diff.forEach( (index) => {
      let current = known[index];
      let rx = rxa[index];
      console.log('party_a change', index, current, rx)
      
      switch(index) {
        // ACCEPTABLE

        // timestamp updates
        case 'cancelled':
        case 'negotiating':
        case 'contractBAccepted':
        case 'startRequested':
        case 'started':
          // should be a timestamp
          if( isNaN( rx ) || rx <= 0 ) {
            tamper = true;
            return false;
          }
          // Existing should be false
          if( current !== false ) {
            tamper = true;
            return false;
          }
          // Approve change
          approvedChanges[index] = rx;
        break;

        // address update
        case 'address':
          // existing should be false
          if( current !== false ) {
            tamper = true;
            return false;
          }
          // we should also validate the address
          let validate = this.wallet.validateCryptoAddress(rx, known_b.currency);

          if( ! validate ) {
            // invalid addresses not accepted
            // negotiations cancelled. no time for losers
            console.log('invalid a address', party_b_currency, rx)
            tamper = true;
            return false;
          }

          approvedChanges[index] = rx;
        break;

        // accept contract
        case 'contract':
          if( current !== false ) {
            return false;
          }

          // check the contract is a hex string
          let hex = false;
          try {
            let buf = Buffer.from(rx, 'hex');
            hex = true;
          } catch (e) {}

          if( ! hex ) return false;

          // This step does not validate the contract, only accepts a hex string.
          approvedChanges[index] = rx;
        break;
  
        // NOT ACCEPTABLE
        default:
          tamper = true;
        break;
      }
    });

    if( Object.keys(approvedChanges).length === 0 ) return false;
    if( tamper !== false ) return false; // tamper with this :middle_finger:
    
    console.log('approved changes party a', approvedChanges);

    // OK approved!
    // Update!

    for (const [k, v] of Object.entries(approvedChanges)) {
      known[k] = v;
    }

    let update = {
      party_a: known
    }

    this.nxDB.updateProposal(id, update);
  },

  // Handle any changes on party_b
  // Only certain elements are acceptable to change

  handleProposalChangesPartyB (id, diff, known, rxa, known_a) {
    console.log('handling party_b changes', diff);
    if( ! diff ) return false;

    let tamper = false;

    let approvedChanges = {};

    diff.forEach( (index) => {
      let current = known[index];
      let rx = rxa[index];
      console.log('party_b change', index, current, rx)
      
      
      switch(index) {
        // ACCEPTABLE

        // timestamp updates
        case 'received': // tell us when you rx'd it, cute, thx
        case 'declined': // decline proposal
        case 'accepted': // accept proposal
        case 'expires': // accept expiry
        case 'contractAAccepted': // accept party_a's contract
        case 'startAccepted':
          // should be a timestamp
          if( isNaN( rx ) || rx <= 0 ) {
            tamper = true;
            return false;
          }
          // Existing should be false
          if( current !== false ) {
            tamper = true;
            return false;
          }
          // Approve change
          approvedChanges[index] = rx;
        break;

        // address update
        case 'address':
          // existing should be false
          if( current !== false ) {
            tamper = true;
            return false;
          }
          // we should also validate the address
          let validate = this.wallet.validateCryptoAddress(rx, known_a.currency);

          if( ! validate ) {
            // invalid addresses not accepted
            // negotiations cancelled. no time for losers
            tamper = true;
            return false;
          }

          approvedChanges[index] = rx;
        break;

        // accept contract
        case 'contract':
          if( current !== false ) {
            return false;
          }

          // check the contract is a hex string
          let hex = false;
          try {
            let buf = Buffer.from(rx, 'hex');
            hex = true;
          } catch (e) {}

          if( ! hex ) return false;

          // This step does not validate the contract, only accepts a hex string.
          approvedChanges[index] = rx;
        break;
  
        // NOT ACCEPTABLE
        default:
          tamper = true;
        break;
      }
    });

    if( Object.keys(approvedChanges).length === 0 ) return false;
    if( tamper !== false ) return false; // tamper with this :middle_finger:
    
    console.log('approved changes', approvedChanges);

    // OK approved!
    // Update!

    for (const [k, v] of Object.entries(approvedChanges)) {
      known[k] = v;
    }

    let update = {
      party_b: known
    }

    this.nxDB.updateProposal(id, update);
  }
}

