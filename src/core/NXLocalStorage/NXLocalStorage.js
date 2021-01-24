// nxswap-js > NXLocalStorage 
// NXLocalStorage.js

const jetpack = require('fs-jetpack');
const store = require('store2');

class NXLocalStorage {
  constructor() {
    this.isBrowser = false;
    this.isNode = false;
    this.selectEnviroment();
    if (!this.isBrowser && !this.isNode) return false;
  }

  /** Browser  **/
  loadBrowserKey(key) {
    let get = store(key);
    if (!get) return false;
    return get;
  }

  saveBrowserKey(key, value) {
    store(key, value);
    return true;
  }

  clearBrowserKey(key) {
    store.remove(key);
    return true;
  }

  /** Files  */
  // Load File
  loadFile(path) {
    let readFile = jetpack.read(path);

    if (!readFile || readFile == undefined) {
      return false;
    }

    return readFile;
  }

  // File exists?
  fileExists(path) {
    let exists = jetpack.exists(path);
    if (!exists || exists == undefined) {
      return false;
    }

    return true;
  }

  // Write file
  writeFile(path, options) {
    if (!path || !options) return false;
    let write = jetpack.file(path, options);
    return true;
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

module.exports = NXLocalStorage;