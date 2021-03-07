// nxswap-core > NXDB > Swap Methods 
// swaps.js

module.exports = {
  insertNewSwap(swap) {
    let swap_id = swap.id;
    if (!swap_id || swap_id === undefined) return false;

    let doesSwapExist = this.doesSwapExist(swap_id);

    if (!doesSwapExist) {
      // Ok.. insert..
      this.db.get('swaps')
        .push(swap)
        .write()

      let checkNow = this.doesSwapExist(swap_id);
      if (checkNow) {
        return true;
      } else {
        return false;
      }
    } else {
      // just temp..
      //should return false
      return true;
    }

    return false;
  },

  updateSwap(id, fields) {
    let update = this.db.get('swaps')
    .find({ id: id })
    .assign(fields)
    .write();

    if( update !== undefined ) {
      return true;
    }

    return false;
  },

  loadSwaps() {
    let load = this.db.get('swaps')
    .orderBy('created', 'desc')
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return load;
  },

  loadUncompletedSwaps() {
    let load = this.db.get(`swaps`)
    .filter({completed: false})
    .orderBy('created', 'asc')
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return load;
  },

  loadSwap(swap_id) {
    let load = this.db.get('swaps')
    .find({ id: swap_id })
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return load;
  },

  doesSwapExist(id) {
    let check = this.db.get('swaps').find({ id: id }).value();
    if (check === undefined) {
      return false;
    }

    return true;
  }
}