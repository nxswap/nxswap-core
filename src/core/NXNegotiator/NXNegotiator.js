// nxswap-js > NXNegotiator 
// NXNegotiator.js
const EventEmitter = require('events');
const { BindToClass } = require('../NXUtil/NXUtil')
const Routine = require('./Routine')
const Methods = require('./Methods')
const Events = require('./Events') 
const Utils = require('./Utils')
const NXAtomicSwap = require('../NXAtomicSwap/NXAtomicSwap')

class NXNegotiator extends EventEmitter {
  constructor({
    nxDB,
    wallet,
    msgr
  }) {
    super();
    // nxDB instance?
    if( ! nxDB || nxDB === undefined ) return false;
    this.nxDB = nxDB;
    if( ! wallet || wallet === undefined ) return false;
    // wallet instance
    this.wallet = wallet;
    if( ! msgr || msgr == undefined ) return false;
    this.msgr = msgr;
    
    // stuff
    this.activeProposals = [];
    this.expiredProposals = [];
    this.proposalStatusMeta = [];
    this.my_pubkey = false;

    // Bind
    BindToClass( Routine, this );
    BindToClass( Methods, this );
    BindToClass( Events, this );
    BindToClass( Utils, this );
  }

  // Called once the wallet has initialised.

  start () {
    this.my_pubkey = this.wallet.getUserAuthPubKey();

    // setup routine
    this.negotiatorRoutineTimeout = setTimeout( () => {
      this.negotiatorRoutine();
    }, 1000);
  }
}

module.exports = NXNegotiator;