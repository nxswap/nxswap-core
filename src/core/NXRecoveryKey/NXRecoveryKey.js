// nxswap-js > NXRecoveryKey 
// NXRecoveryKey.js
const EventEmitter = require('events');
const os = require('os');
const crypto = require('crypto');
const bip39 = require('bip39');
const sjcl = require('sjcl');
const niceware = require('niceware');
const isBase64 = require('is-base64');

const NXRecoveryKeyVersion = "1.0"; // The current version in which new keys are created to.

class NXRecoveryKey extends EventEmitter {
  constructor({
    storage
  }) {
    super();
    if (!storage) throw new Error('NXLOCALSTORAGE_REQUIRED');
    this.storage = storage;
    this.ready = false;
    this.recoveryKey = false;
    this.encryptedRecoveryKey = false;

    this.recoveryKeyLoading = false;
    this.recoveryKeyLoaded = false;
    this.recoveryKeyLocked = false;
  }

  async loadRecoveryKey({
    autoCreate,
    passphrase,
    nodePath,
    nodeFile
  }) {
    this.recoveryKeyLoading = true;
    this.emit('loading', this.recoveryKeyLoading);
    let load;
    if (this.storage.isBrowser) {
      load = await this.loadRecoveryKeyBrowser();
    } else if (this.storage.isNode) {
      load = await this.loadRecoveryKeyNode(nodePath, nodeFile, passphrase, autoCreate);
    }
    // Stop loading..
    this.recoveryKeyLoading = false;
    this.emit('loading', this.recoveryKeyLoading);
    // Return
    return load;
  }

  async loadRecoveryKeyBrowser() {
    let getRecoveryKey = this.storage.loadBrowserKey('NXEncryptedRecoveryKey');

    if (getRecoveryKey !== undefined && getRecoveryKey !== null & getRecoveryKey.length > 0) {
      // Validate Encrypted Key..
      let validateEncrypted = this.validateEncryptedRecoveryKey(getRecoveryKey);
      if (validateEncrypted) {
        this.encryptedRecoveryKey = getRecoveryKey;
        this.recoveryKeyLocked = true;
        this.recoveryKeyLoaded = true;

        // Get encryption key..
        let getEncryptionKey = this.storage.loadBrowserKey('NXEncryptionKey');
        if (getEncryptionKey !== false) {
          // Attempt Decrypt...
          let decryptRecoveryKey = this.decryptRecoveryKey({
            recoveryKey: getRecoveryKey,
            encryptionKey: getEncryptionKey
          });

          if (decryptRecoveryKey) {
            // good?
            this.recoveryKeyLocked = false;
            this.recoveryKey = decryptRecoveryKey;
          } else {
            // hmm.. encryption key must be bad.. clear..
            this.storage.clearBrowserKey('NXEncryptionKey');
          }
        }
      } else {
        this.storage.clearBrowserKey('NXEncryptedRecoveryKey');
      }
    }

    this.emit('locked', this.recoveryKeyLocked);
    this.emit('loaded', this.recoveryKeyLoaded);

    // Send ready..
    if (!this.recoveryKeyLocked && this.recoveryKeyLoaded) {
      this.ready = true;
      this.emit('ready', this.ready);
      return true;
    } else {
      this.ready = false;
      this.emit('ready', this.ready);
      return false;
    }
  }

  async loadRecoveryKeyNode(nodePath, nodeFile, passphrase, autoCreate) {
    if (!nodeFile) return false;

    if (!nodePath) {
      let home = os.homedir();
      if (!home || home === undefined) return false;
      nodePath = home + '/.nxswap/';
    }

    nodePath = nodePath + nodeFile;

    this.ready = false;
    this.emit('ready', this.ready);
    // Attempt to load recovery Key from file system..
    let loadRecoveryKey = await this.storage.loadFile(nodePath);
    if (!loadRecoveryKey) {
      console.log(`Unable to locate recovery key @ ${nodePath}`);
      // autoCreate new recovery key?
      if (autoCreate) {
        // sanity check..
        let exists = this.storage.fileExists(nodePath);
        if (!exists) {
          // Create
          let createRecoveryKey = this.createNewRecoveryKey(passphrase);
          if (!createRecoveryKey) return false;
          let recoveryKeyContent;
          // is it encrypted?
          if (!createRecoveryKey.encryptedRecoveryKey) {
            recoveryKeyContent = createRecoveryKey.recoveryKey;
          } else {
            recoveryKeyContent = createRecoveryKey.encryptedRecoveryKey;
          }
          this.storage.writeFile(nodePath, { content: recoveryKeyContent });
          console.log(`Created new recovery key @ ${nodePath}`);
        }
        // Now we read again..
        loadRecoveryKey = await this.storage.loadFile(nodePath);
      }
    }

    if (!loadRecoveryKey) return false; //er?

    console.log(`Loaded recovery key file ${nodePath}`);
    console.log(`Validating recovery key..`);

    let validateRecoveryKey = this.validateRecoveryKey(loadRecoveryKey);
    if (!validateRecoveryKey) {
      // is it encrypted?
      if (!passphrase) {
        // if its not..
        // then it might need to become a JSON object..
        try {
          loadRecoveryKey = JSON.parse(loadRecoveryKey);
        } catch (e) {
          return false;
        }

        // try again..
        validateRecoveryKey = this.validateRecoveryKey(loadRecoveryKey);

        if (!validateRecoveryKey) {
          console.log('Unable to validate recovery key.')
          return false;
        }
      } else {
        // is it encrypted..
        let validateEncrypted = this.validateEncryptedRecoveryKey(loadRecoveryKey);
        if (!validateEncrypted) {
          return false;
        }

        let decryptRecoveryKey = this.decryptRecoveryKey({
          recoveryKey: loadRecoveryKey,
          passphrase: passphrase
        });
        if (!decryptRecoveryKey) {
          console.log('Unable to decrypt recovery key file.');
          return false;
        }

        // decrypt returns a validated recovery key.
        loadRecoveryKey = decryptRecoveryKey;
      }
    }
    console.log('Validation success');
    this.recoveryKey = loadRecoveryKey;
    this.ready = true;
    this.emit('ready', this.ready);
    return true;
  }

  // Save EncryptedRecoveryKey Browser..
  async saveEncryptedRecoveryKeyBrowser(encryptedRecoveryKey) {
    let save = this.storage.saveBrowserKey('NXEncryptedRecoveryKey', encryptedRecoveryKey);
    if (!save) {
      return false;
    }
    await this.loadRecoveryKeyBrowser();
    return true;
  }

  // Save EncryptionPassphraseHash Browser..
  async saveEncryptionPassphrase(passphrase) {
    if (!passphrase) return false;
    // Convert to hash..
    // Encryption Key is a sha256 hash of the supplied passphrase.
    let encryptionKey = crypto.createHash('sha256').update(passphrase).digest('hex');
    let save = this.storage.saveBrowserKey('NXEncryptionKey', encryptionKey);
    if (!save) {
      return false;
    }

    let attemptLoad = await this.loadRecoveryKeyBrowser();
    return attemptLoad;
  }

  async clearSavedRecoveryKey() {
    this.storage.clearBrowserKey('NXEncryptedRecoveryKey');
    this.storage.clearBrowserKey('NXEncryptionKey');
    this.encryptedRecoveryKey = false;
    this.recoveryKey = false;
    await this.loadRecoveryKeyBrowser();
    return true;
  }

  async clearSavedEncryptionKey() {
    this.storage.clearBrowserKey('NXEncryptionKey');
    this.recoveryKey = false;
    await this.loadRecoveryKeyBrowser();
    return true;
  }

  // createNewRecoveryKey
  // (optional) Supply an encryption passphrase to get back an encrypted recovery key.
  createNewRecoveryKey(passphrase) {
    // A recovery key is currently an object that consists of 3 items
    // (object) { version, Auth, Wallet }
    // Version: Recovery Key version (incase breaking changes are made in the future)
    // Wallet: A HD wallet.
    // --
    let recoveryKey = {
      Version: NXRecoveryKeyVersion
    };
    let encryptedRecoveryKey = false;

    // Wallet
    let walletCreate = this.createNewBip39Seed();
    if (!walletCreate) return false;

    let bip39SeedHex = walletCreate.bip39Seed.toString('hex');

    let Wallet = {
      mnemonic: walletCreate.mnemonic
    }

    recoveryKey.Wallet = Wallet;

    // Recovery key construction completed..
    if (!passphrase) {
      return {
        recoveryKey,
        encryptedRecoveryKey
      }
    } else {
      // Encrypt..
      encryptedRecoveryKey = this.encryptRecoveryKey(recoveryKey, passphrase);
      if (!encryptedRecoveryKey) return false;
      // Do not return the plain text version?
      recoveryKey = false;

      return {
        recoveryKey,
        encryptedRecoveryKey
      }
    }
  }

  encryptRecoveryKey(recoveryKey, passphrase) {
    if (!recoveryKey || !passphrase) return false;
    if (typeof (recoveryKey) !== "object") return false;

    let encryptedRecoveryKey = {
      Version: recoveryKey.Version
    }

    // Pop version out of encryption..
    delete recoveryKey.Version;

    try {
      // Convert recovery key to a string..
      let recoveryKeyString = JSON.stringify(recoveryKey);
      // Encryption Key is a sha256 hash of the supplied passphrase.
      let encryptionKey = crypto.createHash('sha256').update(passphrase).digest('hex');
      // Do it!
      let encrypt = sjcl.encrypt(encryptionKey, recoveryKeyString);

      let keyBuf = Buffer.from(encrypt);
      encryptedRecoveryKey.Key = keyBuf.toString('hex');

      // Base 64 encode..
      let jsonString = JSON.stringify(encryptedRecoveryKey);
      let buf2 = Buffer.from(jsonString);

      encryptedRecoveryKey = buf2.toString('base64');

    } catch (e) {
      return false;
    }

    if (!encryptedRecoveryKey) return false;
    return encryptedRecoveryKey;
  }

  decryptRecoveryKey({ recoveryKey, passphrase, encryptionKey }) {
    if (!recoveryKey || (!passphrase && !encryptionKey)) return false;
    // Attempt to decode..
    // is it base64 encoded?

    if (isBase64(recoveryKey)) {
      try {
        let decode = Buffer.from(recoveryKey, 'base64');
        recoveryKey = JSON.parse(decode);
      } catch (e) {
        // unable to decode base64?
      }
    }

    // Detect version?
    if (typeof (recoveryKey) !== "object") return false;
    if (!recoveryKey.hasOwnProperty('Version')) return false;
    if (!recoveryKey.hasOwnProperty('Key')) return false;

    // ok try and decode..

    let encryptedKey = recoveryKey.Key;
    let decryptedKey = false;

    try {
      if (!encryptionKey || encryptionKey === undefined) {
        encryptionKey = crypto.createHash('sha256').update(passphrase).digest('hex');
      }
      let buf = Buffer.from(encryptedKey, 'hex');
      let string = buf.toString();
      let decodedString = sjcl.decrypt(encryptionKey, string);
      // Should be a stringified JSON..
      decryptedKey = JSON.parse(decodedString);
    } catch (e) {
      console.log(e);
      return false;
    }

    let decryptedRecoveryKey = {
      Version: recoveryKey.Version
    }

    if (typeof (decryptedKey) !== "object") return false;

    for (let item in decryptedKey) {
      let itemC = decryptedKey[item];
      decryptedRecoveryKey[item] = itemC;
    }

    // Validate recovery Key..
    let validateRecoveryKey = this.validateRecoveryKey(decryptedRecoveryKey);
    if (!validateRecoveryKey) return false;

    return decryptedRecoveryKey;
  }

  // Util > Return Wallet Mnemonic..
  returnWalletMnemonic() {
    if (!this.recoveryKey) {
      return false;
    }

    let mnemonic = this.recoveryKey.Wallet.mnemonic;
    if (!mnemonic || mnemonic === undefined) return false;

    return mnemonic;
  }

  // Util > Suggest Passphrase
  suggestPassphrase() {
    const passphrase = niceware.generatePassphrase(6)

    let sep = "-";
    let string = passphrase.toString();

    let string2 = string.replace(/\,/g, sep);
    return string2;
  }

  // Util > Validate Recovery Key..
  validateRecoveryKey(recoveryKey) {
    if (!recoveryKey) return false;
    if (typeof (recoveryKey) !== "object") return false;

    let recoveryKeyVersion = recoveryKey.Version;
    if (!recoveryKeyVersion) return false;

    let validRecoveryKey = false;

    switch (recoveryKeyVersion) {
      case '1.0':
        let recoveryKeyWallet = recoveryKey.Wallet;
        if (!recoveryKeyWallet) return false;
        validRecoveryKey = true;
        break;
      default:
        // Hmm? bad Version..
        break;
    }

    if (!validRecoveryKey) {
      return false;
    }

    return true;
  }

  // Util > Validate Encrypted Recovery Key
  validateEncryptedRecoveryKey(recoveryKey) {
    if (!recoveryKey) return false;

    let wasBase64 = false;

    if (isBase64(recoveryKey)) {
      try {
        let decode = Buffer.from(recoveryKey, 'base64');
        recoveryKey = JSON.parse(decode);
        wasBase64 = true;
      } catch (e) {
        // unable to decode base64?
      }
    }

    if (typeof (recoveryKey) !== "object") return false;

    let recoveryKeyVersion = recoveryKey.Version;
    if (!recoveryKeyVersion) return false;

    let validRecoveryKey = false;

    switch (recoveryKeyVersion) {
      case '1.0':
        let encryptedKey = recoveryKey.Key;
        if (!encryptedKey) return false;
        if (wasBase64) {
          validRecoveryKey = true;
        }
        break;
      default:
        // Hmm? bad Version..
        break;
    }

    if (!validRecoveryKey) {
      return false;
    }

    return true;
  }

  // Util > Create New bip39 Seed
  // Will also return the mnemonic that was used to create it.
  createNewBip39Seed() {
    const mnemonic = bip39.generateMnemonic();
    const bip39Seed = bip39.mnemonicToSeedSync(mnemonic);
    return {
      mnemonic,
      bip39Seed
    }
  }
}

module.exports = NXRecoveryKey;