const os = require('os');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const LocalStorage = require('lowdb/adapters/LocalStorage');
const { BindToClass } = require('../NXUtil/NXUtil')

const Proposals = require('./methods/Proposals');
const Secrets = require('./methods/Secrets');
const Swaps = require('./methods/Swaps');

// Default DB params..
const defaultDBParams = {
  storageMode: 'local'
}

// Empty DB Structure..
const emptyDBStruct = {
  proposals: [],
  secrets: [],
  swaps: []
}

class NXDB {
  constructor() {
    this.recoveryKey = false;
    this.DBParams = false;
    this.db = false;
    // Local
    this.localFilePath = false;
    this.isBrowser = false;
    this.isNode = false;

    BindToClass( Proposals, this );
    BindToClass( Secrets, this );
    BindToClass( Swaps, this );
  }

  // Initialise Database
  // Takes in the loaded, raw recovery key..
  initialiseDB() {
    let localFilePath;
    if (localFilePath !== false) {
      this.localFilePath = localFilePath;
    }

    // Determine DB params.. apply default..
    let DBParams = undefined;
    if (DBParams === undefined) {
      DBParams = defaultDBParams;
      this.DBParams = DBParams
    }

    let DBStorageMode = this.DBParams.storageMode;

    switch (DBStorageMode) {
      default:
      case 'local':
        this.initialiseDBLocal();
        break;
    }

    // Init?
    if (this.db === false) {
      return false;
    }

    // Write defaults to DB if empty..
    this.db.defaults(emptyDBStruct)
      .write()

    return true;
  }

  initialiseDBLocal() {
    // Determine whether browser or node js..
    this.selectEnviroment();
    // Setup..
    if (this.isBrowser) {
      this.initialiseDBLocalBrowser();
    } else if (this.isNode) {
      this.initialiseDBLocalFile();
    }
  }

  initialiseDBLocalBrowser() {
    const adapter = new LocalStorage('NXDB')
    const db = low(adapter)
    this.db = db;
  }

  initialiseDBLocalFile() {
    let path = this.localFilePath;
    if (!this.localFilePath) {
      let home = os.homedir();
      if (!home || home === undefined) return false;
      path = home + '/.nxswap/';
    }

    path = path + 'NXDB.json';

    const adapter = new FileSync(path)
    const db = low(adapter)
    this.db = db;
  }

  // selectEnviroment
  // Is it running in a browser or running with node
  selectEnviroment() {
    if (typeof window === "object" && window.localStorage) {
      this.isBrowser = true;
    } else {
      this.isNode = true;
    }
  }
}

module.exports = NXDB;