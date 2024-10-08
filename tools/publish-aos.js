const Arweave = require('arweave');
const path = require('path');
const fs = require('fs');
const { TurboFactory } = require('@ardrive/turbo-sdk');
const { createData, ArweaveSigner } = require('@dha-team/arbundles');

const changelog = `
# Changelog

### Changed

- Changed default landing page transaction ID.
`;

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
  let wallet = process.env.ARWEAVE_PUBLISHING_KEY;
  if (!wallet) {
    try {
      wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
    } catch (error) {
      console.error(
        'No key found, please set ARWEAVE_PUBLISHING_KEY environment variable or provide a key.json file',
      );
      return;
    }
  }
  const jwk = JSON.parse(wallet);
  const address = await arweave.wallets.jwkToAddress(jwk);
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  const publishingTags = Object.entries({
    'App-Name': 'aos-LUA',
    'App-Version': '0.0.1',
    'Content-Type': 'text/x-lua',
    Author: 'Permanent Data Solutions',
    Changelog: changelog,
  }).map(([name, value]) => ({ name, value }));

  const data1 = await createData(bundledLua, signer, {
    tags: publishingTags,
  });
  await data1.sign(signer);
  const dataTx1 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data1.getRaw().byteLength,
    dataItemStreamFactory: () => data1.getRaw(),
  });

  // replace placeholder with actual tx id
  const bundledLuaWithTxId = bundledLua.replace(
    srcCodeTxIdPlaceholder,
    dataTx1.id,
  );

  const data2 = await createData(bundledLuaWithTxId, signer, {
    tags: [...publishingTags, { name: 'Original-Tx-Id', value: dataTx1.id }],
  });
  await data2.sign(signer);

  const dataTx2 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data2.getRaw().byteLength,
    dataItemStreamFactory: () => data2.getRaw(),
  });

  console.log(
    JSON.stringify({
      ['Lua Code Transaction ID']: dataTx2.id,
      ['Changelog']: changelog,
      ['Published with']: address,
    }),
  );
}
main();
