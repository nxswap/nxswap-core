// nxswap-js > NXNegotiator > routine 
// routine.js

const NXAtomicSwap = require("../NXAtomicSwap/NXAtomicSwap");

module.exports = {

  // negotiator routine
  negotiatorRoutine () {
    // routine stuff
    this.analyseProposals();
    // Build status
    this.buildProposalUI();
    // Ok finished running routine, re-schedule..
    this.negotiatorRoutineTimeout = setTimeout( () => {
      this.negotiatorRoutine();
    }, 1000);
  },

  /**
  * Analyse Proposals
  * > Determine if any action is required
  */

  analyseProposals: function () {
    let loadProposals = this.nxDB.loadProposals();

    if( ! loadProposals || loadProposals === null ) {
      return false;
    }

    let now_proposal_exp = new Date().getTime() + 1000;

    // Loop through all the proposals
    // Seeing if any action is required

    for( let pid in loadProposals ) {
      let proposal = loadProposals[pid];
      this.analyseProposalStatus(proposal);
    }
  },

  analyseProposalStatus: function (proposal) {
    let proposal_id = proposal.id;

    console.log('analysing ', proposal_id );
    console.log( proposal );

    let party_a = proposal.party_a;
    let party_b = proposal.party_b;

    let party_a_pubkey = party_a.pubkey;
    let party_b_pubkey = party_b.pubkey;

    let me_party_a = ( party_a_pubkey === this.my_pubkey );
    let me_party_b = ( party_b_pubkey === this.my_pubkey );

    this.proposalStatusMeta[proposal_id] = {
      me_party_a: me_party_a,
      me_party_b: me_party_b
    };

    let now = new Date().getTime();
    
    // swap negotiation process
    // party_a submits a proposal to party_b
    
    // party_a can cancel the proposal, but only if party_b has not yet accepted or declined
    // if it has been cancelled, not much more to do other than determine if it needs throwing in the trash
    if( party_a.cancelled !== false ) {
      console.log( 'party_a cancelled this proposal' );
      this.proposalStatusMeta[proposal_id].invalid = true;
      this.determineProposalTrashing(proposal_id, party_a.created);
      return false;
    }

    // party_b must either accept or decline the proposal
    // if no answer has been received yet, wait, other than check if it has expired and needs trashing.

    if( party_b.accepted === false && party_b.declined === false ) {
      console.log( 'party_b has not yet responded' );
      // determine if it has expired
      if( party_a.expires < now ) {
        this.proposalStatusMeta[proposal_id].invalid = true;
      }
      this.determineProposalTrashing(proposal_id, party_a.expires );
      return false;
    }

    // Did party_b decline this proposal?

    if( party_b.declined !== false && party_b.declined > 0 ) {
      console.log( 'party_b declined this proposal' );
      this.proposalStatusMeta[proposal_id].invalid = true;
      this.determineProposalTrashing(proposal_id, party_a.expires );
      return false;
    }

    // Has party_b accepted this proposal?
    if( party_b.accepted !== false ) {
      console.log('party_b accepted this proposal');
      // has it expired?
      if( party_b.expires < now ) {
        console.log('the expiry time has passed. negotiations are now over.')
        this.proposalStatusMeta[proposal_id].invalid = true;
        this.determineProposalTrashing(proposal_id, party_a.created );
        return false;
      }
      // OK it hasn't expired..
      this.proposalStatusMeta[proposal_id].negotiating = true;
      console.log('b accepted! not expired! negotitate!!!')

      // Has party_a acknowledged the acceptance and started the negotiation?

      if( party_a.negotiating === undefined || party_a.negotiating === false ) {
        // Nope.. waiting for ack
        // Or am I party_a?

        if( me_party_a ) {
          // Ok I need to ack!
          this.acknowledgeAcceptanceStartNegotiations(proposal_id);
          return false;
        }

        return false;
      }

      if( party_a.negotiating > 0 ) {
        // ok party a has ack and negotiations have started..
        console.log('party a ack! neg started!')
        // the first step is for party_b to provide an address for currency_b so that party_a can provide a contract...
        if( party_b.address === false ) {
          // party_b has not yet provided...
          if( me_party_b ) {
            // oh i am party b!
            // i should provide an address then...
            console.log('oh I am b, i need to send address');
            this.generateAddressForNegotiation(proposal_id, me_party_a, me_party_b);
            return false;
          }
          // ok we will wait
          console.log('still waiting for party_b address!');
        } else {
          // ok we have an address from party_b
          console.log('we have party_b address', party_b.address)
          // next step.. is waiting for party_a's contract...
          if( party_a.contract === false ) {
            // no contract yet..
            if( me_party_a ) {
              // ok I need to make a contract
              // I have party_b's address...
              console.log('i need to make a contract!!! I am A!!')
              this.createAtomicSwapContractPartyA(proposal_id);
              return false;
            } else {
              console.log('i am B! awaiting contract from A! hurry up~')
            }
          } else {
            // party_a contract exists...
            // has it been accepted?
            console.log('has party a contract been accepted by party_b????')

            if( party_b.contractAAccepted === false ) {
              if( me_party_b ) {
                // Oh party b needs to accept party_a contract!
                // First it should be validated!

                let party_a_contract = party_a.contract;
                let validateContract = NXAtomicSwap.decodeAtomicSwapContract(party_a.currency, party_a_contract);
                if( ! validateContract ) return false; // contract invalid? n00b

                console.log('i am party b and i need to validate and accept party_a contract', validateContract)

                // The contract is valid..
                // we should run some prelimiary checks? to see if stuff matches up
                // I mean, no swap would take place without a proper audit of the onchain contract
                // but... wheres the harm in some prelim checks..
                // later though. too excited for swaps. TODO

                this.acceptOtherPartiesContract(proposal_id, me_party_a, me_party_b);
                return false;
              }
              // if not... party_a just needs to wait for party_b to accept the contract
            } else {
              // Ok party_b has accepted party_a's contract
              console.log('party_b has accepted party_a contract! good news!!!!');
              // Next up.. party_a needs to provide an address for party_b to also create their contract.
              if( party_a.address === false ) {
                // party_a still to provide an address
                if( me_party_a ) {
                  // oh me!
                  this.generateAddressForNegotiation(proposal_id, me_party_a, me_party_b);
                  return false;
                } else {
                  console.log('still waiting for party_a to provide an address!');
                  return false;
                }
              } else {
                // ok party_a has provided an address
                console.log('ok party_a has provided an address to!!', party_a.address );
                // Once party_a has provided an address
                // it's down for party_b to create a contract
                console.log('checking for party b contract!');

                if( party_b.contract === false ) {
                  // party_b has not yet created a contract
                  if( me_party_b ) {
                    // ok for me!
                    console.log('i need to make a contract!!! I am B!!')
                    this.createAtomicSwapContractPartyB(proposal_id);
                  } else {
                    console.log('waiting for party_b to submit a contract!!')
                  }
                } else {
                  // ok party_b has created a contract!!!
                  console.log('ok we have the contract for party_b!!!');

                  // has party_a accepted the contract for party_b?

                  if( party_a.contractBAccepted === false ) {
                    // seems not!
                    if( me_party_a ) {
                      console.log('i need to accept party_bs contract!!');
                      let party_b_contract = party_b.contract;
                      let validateContract = NXAtomicSwap.decodeAtomicSwapContract(party_b.currency, party_b_contract);
                      if( ! validateContract ) return false; // contract invalid? n00b

                      console.log('i am party a and i need to validate and accept party_b contract', validateContract)

                      // The contract is valid..
                      // same as party b.. should do prelims. TODO

                      this.acceptOtherPartiesContract(proposal_id, me_party_a, me_party_b);

                    } else {
                      console.log('waiting for party_a to accept party_b contract!')
                    }
                  } else {
                    console.log('ok!!! both party_a and party_b have accepted each others contracts!!! this is good!!!');

                    // now the final process, is for party_a to request start, party_b to accept start and then party_a to inform of start
                    // As one final handshake. Also allows this always to be the final start signal and other steps added in between?

                    if( party_a.started === false ) {
                      // Not yet started...
                      // Has it been requested?
                      if( party_a.startRequested === false ) {
                        if( me_party_a ) {
                          // ok I need to request to start the swap!
                          console.log('i am ready! requesting swap start');
                          this.requestStartSwap(proposal_id);
                          return false;
                        } else {
                          console.log('waiting for party_a to request start!')
                        }
                      } else {
                        if( party_b.startAccepted === false ) {
                          if( me_party_b ) {
                            console.log('party_a has requested for the swap start.. i need to respond');
                            this.acceptStartSwap(proposal_id);
                            return false;
                          } else {
                            console.log('waiting for party_b to accept the swap start')
                          }
                        } else {
                          if( me_party_a ) {
                            console.log('starting the swap!!')
                            this.startSwap(proposal_id);
                            return false;
                          } else {
                            console.log('i accepted! waiting for party_a to start the swap!!');
                          }
                        }
                      }
                    } else {
                      // it must get to this stage...
                      // before party_b's time expires
                      // then we convert it into a swap.. and the rest is onchain.
                      console.log('the swap has started!!!!!!!! ack!!!');
                      // ok convert it to a swap...
                      let createSwap = this.wallet.createNewSwap(proposal);

                      if( ! createSwap ) {
                        console.log('failed to create new swap');
                        return false;
                      } else {
                        console.log('created Swap, now delete proposal!');
                        this.nxDB.deleteProposal(proposal_id);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log('analysis ongoing!!');

  },

  determineProposalTrashing(proposal_id, expiry) {
    let trash_after = 360000; // 1 hour for now
    let now_proposal_exp = new Date().getTime();

    if( ( expiry + trash_after ) < now_proposal_exp ) {
      this.nxDB.deleteProposal(proposal_id);
    }
  },

  // Build UI

  buildProposalUI: function () {
    let loadProposals = this.nxDB.loadProposals();

    if( ! loadProposals || loadProposals === null ) {
      this.emit('activeProposals', false );
      this.emit('expiredProposals', false );
      return false;
    }

    loadProposals = _.cloneDeep(loadProposals);

    let activeProposals = [];
    let expiredProposals = [];

    for( let pid in loadProposals ) {
      let proposal = loadProposals[pid];
      let proposal_id = proposal.id;

      let proposalStatusMeta = this.proposalStatusMeta[proposal_id];
      proposal = {...proposal, ...proposalStatusMeta}

      if( proposal.invalid === true ) {
        expiredProposals.push(proposal);
      } else {
        // Push to activeProposals
        activeProposals.push(proposal);
      }
    }

    // Set proposals
    this.activeProposals = activeProposals;
    this.expiredProposals = expiredProposals;

    if( activeProposals.length > 0 ) {
      this.emit('activeProposals', activeProposals );
    } else {
      this.emit('activeProposals', false );
    }

    if( expiredProposals.length > 0 ) {
      this.emit('expiredProposals', expiredProposals );
    } else {
      this.emit('expiredProposals', false );
    }
  }
}