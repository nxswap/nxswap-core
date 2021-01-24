// nxswap-js > NXWallet > Swaps 
// Swaps.js

const NXAtomicSwap = require('../NXAtomicSwap/NXAtomicSwap')

module.exports = {
  // Start Swap Monitor Routine..
  startSwapMonitorRoutine: function () {
    this.swapMonitorRoutine();
  },

  // Swap Monitor Routine
  // Responsible for monitoring swaps and doing swap stuff 
  swapMonitorRoutine: function () {
    console.log('--Running Swap Monitor Routine--');
    // Do Swap Stuff
    this.analyseKnownSwaps();
    // Do UI
    this.buildSwapUI();
    // Ok finished running routine, re-schedule..
    this.swapMonitorRoutineTimeout = setTimeout( () => {
      this.swapMonitorRoutine();
    }, 5000);
  },

  // Analyse Known Swaps
  // Eventually we will have blockchain recovery... so if you lost db mid way? random? can recover swap.. 
  // for now the DB must be known.
  analyseKnownSwaps: function () {
    // Load Swaps that are marked as uncompleted..
    let loadUncompletedSwaps = this.nxDB.loadUncompletedSwaps();
    if( ! loadUncompletedSwaps ) {
      return false;
    }

    for( let sid in loadUncompletedSwaps ) {
      let swap = loadUncompletedSwaps[sid];
      this.analyseSwap(swap);
    }
  },

  // Analyse Swap
  // Takes a db entry and works out if we need to anything.
  analyseSwap: async function(swap) {
    let swap_id = swap.id;
    if( ! swap_id ) return false;
    console.log('analysing swap - ', swap_id, swap );

    let proposal = swap.proposal;
    let party_a = proposal.party_a;
    let party_b = proposal.party_b;

    let swap_meta = swap.meta;

    let me_party_a = swap_meta.me_party_a;
    let me_party_b = swap_meta.me_party_b;

    let currency_a = party_a.currency;
    let currency_b = party_b.currency;

    let contract_a = party_a.contract;
    let contract_b = party_b.contract;

    let contract_a_decoded = NXAtomicSwap.decodeAtomicSwapContract(currency_a, contract_a);
    let contract_b_decoded = NXAtomicSwap.decodeAtomicSwapContract(currency_b, contract_b);

    let contract_a_address = contract_a_decoded.scriptAddress;
    let contract_b_address = contract_b_decoded.scriptAddress;

    // THE SWAP PART
    // Stage 1 - party_a to pay into their contract on the currency_a blockchain
    // Need to determine whether that has been done..
    // using auditAtomicSwapContract, it does all the work

    // Check explorer is connected
    let explorer_a = this.returnExplorer(currency_a);

    if( ! explorer_a.isConnected() ) {
      console.log('explorer a not connected, unable to connect', currency_a );
      return false;
    }

    let explorer_b = this.returnExplorer(currency_b);

    if( ! explorer_b.isConnected() ) {
      console.log('explorer b not connected, unable to connect', currency_b );
      return false;
    }

    // auditAtomicSwapScript
    // does lots of funky stuff
    // but it should do more. neaten it up
    // TODO

    let audit_a = await NXAtomicSwap.auditAtomicSwapScript(currency_a, contract_a, explorer_a);
         
    if( ! audit_a ) {
      console.log('audit_a failed!')
      return false;
    }

    let audit_b = await NXAtomicSwap.auditAtomicSwapScript(currency_b, contract_b, explorer_b);

    console.log('audit_a', audit_a);
    console.log('audit_b', audit_b);

    if( me_party_a ) {
      // Party_a is responsible for submitting contract_a
      // Check if it has been done or not.. 
      console.log('I am party_a.. seeing if I need to do anything on contract_a');

      if( audit_a.scriptRedeemed ) {
        console.log('hey? script_a has been redeemed! this means SWAP COMPLETED BRO!!');
        // maybe we should have a cool off period..
        // check it doesn't reverse n shit...
        // for now... complete it!

        let update = this.nxDB.updateSwap(swap_id, {
          completed: new Date().getTime()
        });

        if( ! update ) return false;

        console.log('updated swap! now completed');

        return false;
      } else if( audit_a.scriptValidUtxos === false ) {
        // no utxos found?
        // check db..
        if( swap.initiate === undefined || swap.initiate === false ) {
          // ok agreed.. no utxos found
          console.log('I am party_a, i have not yet sent the initiate transaction..');

          // Lots of checks should be run here
          // but TODO
          // proof of concept yo

          // First we need to build the transaction..

          let outputs = [{ address: contract_a_address, value: party_a.amount * 100000000 }]; // WOOPS TEMP FIX TODO!!!
          let create = this.createSendTransaction(currency_a, false, outputs, false);
          if( ! create ) return false;

          // OK we have the transaction...
          // lets save it to the db..

          let initiate = {
            tx: create,
            time: new Date().getTime()
          }

          let update = this.nxDB.updateSwap(swap_id, {
            initiate: initiate
          });

          if( ! update ) return false;

          // TODO
          // More checks? check against the wallet? n stuff? i dunno
          // lets just send it! balls deep

          let send = this.sendTransaction(currency_a, create);

          if( ! send ) {
            console.log('failed to send??');
            return false;
          }

          console.log('tx sent!');

        } else {
          // oh shit.. we did create tx?
          // wot u do wiv my tx
          console.log(':shrug:')
          // need to add some kind of repeat broadcast?
          // TODO
        }
      } else {
        console.log('my tx is visible! y no redeem.. maybe unconfirmed?');
        // no action needed anyway... not yet...
        // maybe we need to redeem b????
        // exciting

        if( swap.redeem !== false ) {
          // oh we already redeemed? wot?
          return false;
        }

        if( audit_b.scriptValidUtxos !== false ) {
          console.log('ooo party_b has paid into their side of it...');

          if( audit_b.scriptUtxoConfirmedTotal > 0 ) {
            // it' time to sweep!!!

            console.log('oo now we can redeem.... attempting...!!!');

            // naughty?

            let sign_a = this.returnSigningObjectForAddress(currency_b, party_a.address);

            // redeeem
            let secret_a = swap.secretPair.secret;
            let redeemContract = await NXAtomicSwap.redeemAtomicSwapContract(currency_b, contract_b, secret_a, explorer_b, sign_a );

            console.log('redeemContract', redeemContract);

            if( ! redeemContract ) return false;


            // ok we have a redeem tx!

            let redeem = {
              tx: redeemContract.txHex,
              time: new Date().getTime()
            }

            let update = this.nxDB.updateSwap(swap_id, {
              redeem: redeem
            });

            if( ! update ) return false;

            console.log( 'ok good to redeem?')

            let send = this.sendTransaction(currency_b, redeemContract.txHex);

            if( ! send ) {
              console.log('failed to send??');
              return false;
            }

            console.log('tx sent!');

            return false;

          } else {
            console.log('waiting for party_b to confirm! before sweeping');
          }
        }

        return false
      }
    } else if( me_party_b ) {
      // Party_b needs to wait for contract_a to be submitted...

      console.log('i am b!? waiting bro')

      if( audit_a.scriptRedeemed === false ) {
        console.log(' i havent redeemed a yet... maybe i did not do b');

        // See if i have paid into b?
        if( audit_b.scriptRedeemed ) {
          // oooooo b has been redeemed
          console.log('oh b has been redeemed!!');

          // Have we extracted?

          if( swap.extractedSecret === undefined || swap.extractedSecret === false ) {
            let getSecret = await NXAtomicSwap.extractAtomicSwapSecret(currency_b, contract_b, explorer_b )

            if( ! getSecret ) {
              console.log('unable to extract secret???')
              return false;
            }

            // Ok UPDATE...

            let extractedSecret = {
              txid: getSecret.redemptionTxId,
              secret: getSecret.extractedSecret
            }

            let update = this.nxDB.updateSwap(swap_id, {
              extractedSecret: extractedSecret
            });

            if( ! update ) return false;
  
            console.log('getSecret complete', getSecret)
            return false;
          }

          // confirmations or not, we don't care... we can get the secret key!!!

          console.log('we have the secret pair!!', swap.extractedSecret);
          
          // Once we have the secret...
          // we just need to redeem party_a...

          if( swap.redeem === false ) {

            // ok we need to redeem...
            let sign_b = this.returnSigningObjectForAddress(currency_a, party_b.address);

            // redeeem
            let secret_b = swap.extractedSecret.secret;
            let redeemContract = await NXAtomicSwap.redeemAtomicSwapContract(currency_a, contract_a, secret_b, explorer_a, sign_b );

            console.log('redeemContract', redeemContract);

            if( ! redeemContract ) return false;


            // ok we have a redeem tx!

            let redeem = {
              tx: redeemContract.txHex,
              time: new Date().getTime()
            }

            let update = this.nxDB.updateSwap(swap_id, {
              redeem: redeem
            });

            if( ! update ) return false;

            console.log( 'ok good to redeem?')

            let send = this.sendTransaction(currency_a, redeemContract.txHex);

            if( ! send ) {
              console.log('failed to send??');
              return false;
            }

            console.log('tx sent!');

            return false;

          } else {
            // maybe re-broadcast
            console.log(' we did redeem? y no see transaction');
            return false;
          }
        } 
        else if( audit_b.scriptValidUtxos === false ) {
          // Nope not yet...
          // have i audited a?
          console.log('no valid tx for party_b contract yet');

          if( swap.initiate === false ) {
            // OK not approved audit just yet...

            console.log('need to approve audit on party_a contract')

            if( audit_a.scriptUtxoConfirmedTotal > 0 ) {
              console.log('oo confirmed!!')

              // check the amount is correct....
              // oh but the audit would have done that? eventually..

              // confirm audit...

              let update = this.nxDB.updateSwap(swap_id, {
                initiate: audit_a
              });

              if( ! update ) return false;

              // ok we confirmed the audit...

            } else {
              console.log('not yet confirmed. can not completed audit. waiting. come back soon')
              return false;
            }
          } else {
            // ok gthe audit was approved...
            console.log('party_b: we approved the audit of party_a... now our turn...');

            // check we haven't already done b?

            if( swap.participate !== false ) {
              console.log('we did it already?')

              // ok maybe we need to, re-broadcast? maybe explorer slow?
              return false;
            }

            // THIS IS WHERE B PAYS ON CHAIN

            let outputs = [{ address: contract_b_address, value: party_b.amount * 100000000 }]; // WOOPS TEMP FIX TODO!!!
            let create = this.createSendTransaction(currency_b, false, outputs, false);
            if( ! create ) return false;

            // OK we have the transaction...
            // lets save it to the db..

            let participate = {
              tx: create,
              time: new Date().getTime()
            }

            let update = this.nxDB.updateSwap(swap_id, {
              participate: participate
            });

            if( ! update ) return false;

            // TODO
            // More checks? check against the wallet? n stuff? i dunno
            // lets just send it! balls deep

            let send = this.sendTransaction(currency_b, create);

            if( ! send ) {
              console.log('failed to send??');
              return false;
            }

            console.log('tx sent!');


          }
        } else {
          // i did do B!
          // maybe no confs yet
          console.log('oh i did do b! maybe no confs yet on b')
        }
      } else {
        console.log('i redeemed a? this is success!!!! swap done bro!!!!!');

        // other checks like ensuring it goes through? confirmations?
        // for now? just confirm it

        let update = this.nxDB.updateSwap(swap_id, {
          completed: new Date().getTime()
        });

        if( ! update ) return false;

        console.log('updated swap! now completed');
      }
    }
    

    // Meta, for UI mainly
    this.swapStatusMeta[swap_id] = {};
  },

  buildSwapUI: function () {
    let loadSwaps = this.nxDB.loadSwaps();

    if( ! loadSwaps || loadSwaps === null ) {
      this.emit('loadSwaps', false );
      return false;
    }

    loadSwaps = _.cloneDeep(loadSwaps);
    let swaps = [];

    for( let pid in loadSwaps ) {
      let swap = loadSwaps[pid];
      let swap_id = swap.id;

      let swapStatusMeta = this.swapStatusMeta[swap_id];
      swap = {...swap, ...swapStatusMeta}

      swaps.push(swap);
    }

    // Set proposals
    this.loadSwaps = swaps;

    if( swaps.length > 0 ) {
      this.emit('loadSwaps', swaps );
    } else {
      this.emit('loadSwaps', false );
    }
  }
}