import path, { dirname } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { createData, ArweaveSigner } from '@dha-team/arbundles';
import version from '../version.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bundledLua = fs.readFileSync(
  path.join(__dirname, '../dist/aos-bundled.lua'),
  'utf-8',
);

const dryRun =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

const walletPath = process.argv.includes('--wallet-file')
  ? process.argv[process.argv.indexOf('--wallet-file') + 1]
  : process.env.WALLET_PATH || path.join(__dirname, 'key.json');

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

const data = createData(bundledLua, signer, {
  tags: publishingTags,
});
await data.sign(signer);

console.log('Generated source code data item with id: ' + data.id);

if (!dryRun) {
  console.log('Publishing ANT Source code to Arweave...');
  await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data.getRaw().byteLength,
    dataItemStreamFactory: () => data.getRaw(),
  });
}
console.log('Tagged source code tx id: ' + data.id);
