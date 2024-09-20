const Arweave = require('arweave');
const path = require('path');
const fs = require('fs');

const srcCodeTxIdPlaceholder = '__INSERT_SOURCE_CODE_ID__';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});
async function main() {
  const bundledLua = fs.readFileSync(
    path.join(__dirname, '../dist/aos-bundled.lua'),
    'utf-8',
  );
  const wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
  const jwk = JSON.parse(wallet);
  const address = await arweave.wallets.jwkToAddress(jwk);

  const tx1 = await arweave.createTransaction({ data: bundledLua }, jwk);
  tx1.addTag('App-Name', 'aos-LUA');
  tx1.addTag('App-Version', '0.0.1');
  tx1.addTag('Content-Type', 'text/x-lua');
  tx1.addTag('Author', 'Permanent Data Solutions');
  await arweave.transactions.sign(tx1, jwk);
  await arweave.transactions.post(tx1);

  // replace placeholder with actual tx id
  const bundledLuaWithTxId = bundledLua.replace(srcCodeTxIdPlaceholder, tx1.id);

  console.log(`Publish AOS ANT Lua with address ${address}`);

  const tx = await arweave.createTransaction({ data: bundledLuaWithTxId }, jwk);
  tx.addTag('App-Name', 'aos-LUA');
  tx.addTag('App-Version', '0.0.1');
  tx.addTag('Content-Type', 'text/x-lua');
  tx.addTag('Author', 'Permanent Data Solutions');
  tx.addTag('Original-Tx-Id', tx1.id);
  tx.addTag(
    'Changelog',
    `# Changelog

### Fixed

- Repaired permission handling in Evolve handler to disallow modification of the SourceCodeTxId field by non-owners.

`,
  );
  await arweave.transactions.sign(tx, jwk);
  await arweave.transactions.post(tx);

  console.log('Transaction ID:', tx.id);
}
main();
