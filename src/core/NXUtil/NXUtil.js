const crypto = require("crypto");

module.exports = {
  BindToClass: function(functionsObject, thisClass) {
    for (let [ functionKey, functionValue ] of Object.entries(functionsObject)) {
        thisClass[functionKey] = functionValue.bind(thisClass);
    }
  },

  // Crypto Utilities

  hash_sha256( string, hex ) {
   
  } 
}