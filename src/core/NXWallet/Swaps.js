// nxswap-js > NXWallet > Swaps 
// Swaps.js

const { isValidProposalStructure, hashProposal } = require('../NXNegotiator/Utils');

module.exports = {
  // Create New Swap
  // Takes a proposal from NXNegotiator and converts it into a Swap
  createNewSwap: function(proposal) {
    console.log('attempting to create new swap', proposal);
    // Validate the proposal structure..
    let validateProposal = isValidProposalStructure(proposal);
    if( ! validateProposal ) return false;

    // Hash proposal
    let hash = hashProposal(proposal);

    let swap_id = proposal.id;

    // Check this swap does not already exist...
    if( this.nxDB.doesSwapExist(swap_id) !== false ) {
      console.log('swap already exists!')
      return true;
    }

    let secretPair = false;

    // Am i Party A?

    if( this.getUserAuthPubKey() == proposal.party_a.pubkey ) {
      // Load the secret..
      let loadSecret = this.nxDB.loadSecretPair(swap_id);
      if( ! loadSecret ) {
        console.log('failed to load secret')
        return false;
      }
      secretPair = loadSecret;
      // Verify the secret?
      console.log('verify secret', secretPair);
      // TODO
      // SANITY CHECK, VERIFY WE HAVE THE SECRET?
    }

    // Do some pre stuff
    // Save on reptition later.
    let party_a = proposal.party_a;
    let party_b = proposal.party_b;

    let party_a_pubkey = party_a.pubkey;
    let party_b_pubkey = party_b.pubkey;

    let my_pubkey = this.getUserAuthPubKey();
    let me_party_a = ( party_a_pubkey === my_pubkey );
    let me_party_b = ( party_b_pubkey === my_pubkey );
    
    // Create Swap Structure
    let created = new Date().getTime(); 

    let swap = {
      id: swap_id,
      proposal: proposal,
      proposalHash: hash,
      secretPair: secretPair,
      created: created,
      completed: false,
      meta: {
        me_party_a: me_party_a,
        me_party_b: me_party_b
      },
      initiate: false,
      participate: false,
      redeem: false,
      extractedSecret: false
    }

    // Insert Swap
    let insert = this.nxDB.insertNewSwap(swap);
    if( ! insert ) {
      return false;
    }

    return true;
  }
}