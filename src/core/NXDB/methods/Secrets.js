// nxswap-js > NXDB > Secrets Methods 
// secrets.js

module.exports = {

  insertSecretPair(proposal_id, secretPair) {
    if( ! this.doesSecretPairExist(proposal_id) ) {
      let secret = {
        id: proposal_id
      }

      secret = {...secret, ...secretPair};

      this.db.get(`secrets`)
        .push(secret)
        .write()

      let checkNow = this.doesSecretPairExist(proposal_id);
      if (checkNow) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },

  loadSecretPair(id) {
    let load = this.db.get(`secrets`)
    .find({ id: id })
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return load;
  },

  doesSecretPairExist(proposal_id) {
    let check = this.db.get(`secrets`).find({ id: proposal_id }).value();
    if (check === undefined) {
      return false;
    }

    return true;
  }
}