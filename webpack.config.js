const path = require('path');

module.exports = {
  entry: {
    NXSwap: './src/nxswap.js',
    ExplorerBlockbook: './src/explorers/explorerBlockbook.js',
    NXBlockbookAPI: './src/explorers/blockbook-api.js'
  },
  node: { fs: 'empty', net: 'empty', tls: 'empty' },
  target: 'web',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: '[name]'
  },
  mode: 'development'
};