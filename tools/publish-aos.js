const Arweave = require('arweave');
const path = require('path');
const fs = require('fs');
const { TurboFactory } = require('@ardrive/turbo-sdk');
const { createData, ArweaveSigner } = require('@dha-team/arbundles');
const version = require('../version.js');

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

  let wallet = process.env.WALLET;
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
  const signer = new ArweaveSigner(jwk);
  const turbo = TurboFactory.authenticated({ signer });

  const publishingTags = Object.entries({
    'App-Name': 'aos-LUA',
    'App-Version': version,
    'Content-Type': 'text/x-lua',
    Author: 'Permanent Data Solutions',
    'Git-Hash': process.env.GITHUB_SHA,
  }).map(([name, value]) => ({ name, value }));

  const data1 = createData(bundledLua, signer, {
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
  // Deploying the code twice is necessary to inject the source code id into the bundled code
  // TODO: move this to incremental versioning instead of using the source code id
  const data2 = createData(bundledLuaWithTxId, signer, {
    tags: [...publishingTags, { name: 'Original-Tx-Id', value: dataTx1.id }],
  });
  await data2.sign(signer);

  const dataTx2 = await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data2.getRaw().byteLength,
    dataItemStreamFactory: () => data2.getRaw(),
  });

  console.log('publishedLuaTxId.' + dataTx2.id);
}
main();
