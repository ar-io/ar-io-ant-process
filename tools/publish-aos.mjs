import path, { dirname } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { createData, ArweaveSigner } from '@dha-team/arbundles';
import version from '../version.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcCodeTxIdPlaceholder = '__INSERT_SOURCE_CODE_ID__';

const bundledLua = fs.readFileSync(
  path.join(__dirname, '../dist/aos-bundled.lua'),
  'utf-8',
);

const dryRun =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const walletPath = process.argv.includes('--wallet-file')
  ? process.argv[process.argv.indexOf('--wallet-file') + 1]
  : process.env.WALLET_PATH || 'key.json';
const jwk = process.env.WALLET
  ? JSON.parse(process.env.WALLET)
  : JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
const signer = new ArweaveSigner(jwk);
const turbo = TurboFactory.authenticated({ signer });
const publishingTags = Object.entries({
  'App-Name': 'AR-IO-ANT-Deploy',
  'App-Version': '0.0.1',
  'AR-IO-ANT-Version': `${version}`,
  'Content-Type': 'text/x-lua',
  Author: 'Permanent Data Solutions',
  'Git-Hash': process.env.GITHUB_SHA,
})
  .filter(([_, value]) => value !== undefined)
  .map(([name, value]) => ({ name, value }));

console.log(publishingTags);

/**
 * NOTE: with the current use of SOURCE-CODE-TX-ID, we have to publish the generate the source code twice
 * to get the tx id into the bundled file. In the future, we should move to using incremental
 * bundle versions to avoid this issue.
 */
const data1 = createData(bundledLua, signer, {
  tags: publishingTags,
});
await data1.sign(signer);

console.log('Generated source code data item with id: ' + data1.id);
// replace placeholder with actual tx id
const bundledLuaWithTxId = bundledLua.replace(srcCodeTxIdPlaceholder, data1.id);

const data2 = createData(bundledLuaWithTxId, signer, {
  tags: [...publishingTags, { name: 'Original-Tx-Id', value: data1.id }],
});
await data2.sign(signer);

console.log('Generated bundled data item with id: ' + data2.id);

if (!dryRun) {
  console.log('Publishing ANT Source code to Arweave...');
  await Promise.all([
    turbo.uploadDataItem({
      dataItemSizeFactory: () => data1.getRaw().byteLength,
      dataItemStreamFactory: () => data1.getRaw(),
    }),
    turbo.uploadDataItem({
      dataItemSizeFactory: () => data2.getRaw().byteLength,
      dataItemStreamFactory: () => data2.getRaw(),
    }),
  ]);
  console.log('publishedLuaTxId.' + dataTx2.id);
}
console.log('Tagged source code tx id: ' + data1.id);
