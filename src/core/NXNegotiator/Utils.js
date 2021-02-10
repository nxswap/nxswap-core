// nxswap-core > NXNegotiator > Utils 
// Utils.js

const crypto = require('crypto');
const secp256k1 = require('secp256k1');

module.exports = {

  signProposalMessage: function(msg) {
    let msg_stringify = JSON.stringify(msg);
    let hash = crypto.createHash('sha256').update(msg_stringify).digest('hex');
    let msg_hash_buf = Buffer.from(hash, 'hex');
  
    let signObject = this.wallet.getUserAuthObject();
    if( ! signObject.pubKey || ! signObject.privKey ) return false;
  
    let pubKey = signObject.pubKey;
    let privKey = signObject.privKey;
  
    // sign the message
    const sigObj = secp256k1.ecdsaSign(msg_hash_buf, privKey)
    let sigBuf = Buffer.from(sigObj.signature);
    let signature = sigBuf.toString('base64');
  
    // Sanity verify..
    let verifyBuf = Buffer.from(signature, 'base64');
    const verify = secp256k1.ecdsaVerify(verifyBuf, msg_hash_buf, pubKey);
  
    if( ! verify) {
        return false;
    }

    return {
      signature,
      hash
    }
  },

  isValidProposalMessageStructure: function(message, my_pubkey) {
    if( ! 'proposal' in message ) return false;
    if( ! 'hash' in message ) return false;
    if( ! 'sig' in message) return false;

    // Structure Valid..
    let proposal = message.proposal;
    let hash = message.hash;
    let sig = message.sig;

    // Now validate the proposal structure..
    if( ! this.isValidProposalStructure( proposal, true ) ) return false;

    // Now verify the proposal signature..
    if( ! this.verifyProposalSignature( proposal, hash, sig, my_pubkey ) ) return false;

    return true;
  },

  isValidProposalStructure: function(proposal, signed) {
    // Does the proposal match teh expected format?
    // bodgey
    // do more

    if( ! 'id' in proposal ) return false;

    let id = proposal.id;
    let idver = false;

    try {
      let idbuf = Buffer.from(id, 'hex');
      if( ! idbuf || idbuf.length !== 34 ) return false;
      idver = true;
    } catch (e) { }

    if( ! idver ) return false;

    if( ! 'party_a' in proposal ) return false;
    if( ! 'party_b' in proposal ) return false;

    let party_a = proposal.party_a;
    let party_b = proposal.party_b;

    if( ! 'pubkey' in party_a ) return false;
    if( ! 'currency' in party_a ) return false;
    if( ! 'amount' in party_a ) return false;

    if( ! 'pubkey' in party_b ) return false;
    if( ! 'currency' in party_b ) return false;
    if( ! 'amount' in party_b ) return false;

    if( signed ) {
      if( ! 'hash' in proposal ) return false;
      if( ! 'sig' in proposal ) return false;
    }

    return true;
  },

  verifyProposalSignature: function (proposal, hash, sig, my_pubkey) {
    if( ! this.isValidProposalStructure(proposal, true) ) return false;

    let verifySig = false;
    // if we are party_a
    // we are verifying party_b sig and vice versa
    if( proposal.party_a.pubkey === my_pubkey ) {
      verifySig = this.verifySig(hash, sig, proposal.party_b.pubkey, proposal);
    } else if( proposal.party_b.pubkey === my_pubkey ) {
      verifySig = this.verifySig(hash, sig, proposal.party_a.pubkey, proposal);
    }
    
    if( ! verifySig ) return false;
    return true;
  },

  verifySig: function(hash, sig, pubkey, object) {

    let rem_stringify = JSON.stringify(object);
    let rem_hash = crypto.createHash('sha256').update(rem_stringify).digest('hex');

    if( rem_hash !== hash ) return false;

    // a proposal should be signed by party a
    let pubkey_buf = Buffer.from(pubkey, 'hex');
    let hash_buf = Buffer.from(hash, 'hex');

    let sig_buf = Buffer.from(sig, 'base64');
    const verify = secp256k1.ecdsaVerify(sig_buf, hash_buf, pubkey_buf);
  
    if( ! verify) {
      return false;
    }

    return true;
  },

  hashProposal: function(proposal) {
    let proposal_stringify = JSON.stringify(proposal);
    let hash = crypto.createHash('sha256').update(proposal_stringify).digest('hex');
    return hash;
  },

  // get differences between 2 objects
  // https://stackoverflow.com/questions/31683075/how-to-do-a-deep-comparison-between-2-objects-with-lodash/40610459#40610459
  
  getProposalDifferences(obj1,obj2) {
    const diff = Object.keys(obj1).reduce((result, key) => {
        if (!obj2.hasOwnProperty(key)) {
            result.push(key);
        } else if (_.isEqual(obj1[key], obj2[key])) {
            const resultKeyIndex = result.indexOf(key);
            result.splice(resultKeyIndex, 1);
        }
        return result;
    }, Object.keys(obj2));

    if( diff.length == 0 ) return false;
    return diff;
  }
}