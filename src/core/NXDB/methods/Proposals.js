// nxswap-js > NXDB > Proposals Methods 
// proposals.js

module.exports = {
  insertNewProposal({...proposal}) {
    let proposal_id = proposal.id;
    if( ! proposal_id || proposal_id === undefined ) return false;

    let doesProposalExist = this.doesProposalExist(proposal_id);

    if( ! doesProposalExist ) {
      this.db.get(`proposals`)
        .push(proposal)
        .write()

      let checkNow = this.doesProposalExist(proposal_id);
      if (checkNow) {
        return true;
      } else {
        return false;
      }
    } else {
      // it already exists?
      // how? this should be an updateProposal
      return false;
    }
  },

  async updateProposal(id, fields) {
    let update = await this.db.get(`proposals`)
    .find({ id: id })
    .assign(fields)
    .write();

    console.log('update', update)

    if( update !== undefined ) {
      return true;
    }

    return false;
  },

  async deleteProposal(id) {
    let d = await this.db.get(`proposals`)
    .remove({ id: id })
    .write();

    console.log('delete', d)

    if( d !== undefined ) {
      return true;
    }

    return false;
  },

  loadProposals() {
    let load = this.db.get(`proposals`)
    .orderBy(['expires'], ['asc'])
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return {...load};
  },

  loadProposal(id) {
    let load = this.db.get(`proposals`)
    .find({ id: id })
    .value();

    if( load === undefined || load.length == 0 ) {
      return false;
    }

    return {...load};
  },

  doesProposalExist(proposal_id) {
    let check = this.db.get(`proposals`).find({ id: proposal_id }).value();
    if (check === undefined) {
      return false;
    }

    return true;
  }

}