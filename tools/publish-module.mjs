import path, { dirname } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { createData, ArweaveSigner } from '@dha-team/arbundles';
import yaml from 'js-yaml';
import version from '../version.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wasmBinary = fs.readFileSync(
  path.join(__dirname, '../dist/aos-ant.wasm'),
);

// Read the file
const configContent = fs.readFileSync(
  path.join(__dirname, '../ao-build-config.yml'),
  'utf-8',
);

// Parse the YAML content
const config = yaml.load(configContent);

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
  // ao tags
  'Data-Protocol': 'ao',
  Variant: 'ao.TN.1',
  Type: 'Module',
  'Input-Encoding': 'JSON-1',
  'Output-Encoding': 'JSON-1',
  'Content-Type': 'application/wasm',
  'Compute-Limit': config.compute_limit.toString(),
  'Memory-Limit': config.maximum_memory.toString() + '-b',
  'Module-Format': config.module_format,
  // extra tags
  'App-Name': 'AR-IO-ANT-Deploy',
  'App-Version': '0.0.1',
  'AR-IO-ANT-Version': `${version}`,
  Author: 'Permanent Data Solutions',
  'Git-Hash': process.env.GITHUB_SHA ?? 'no-git-hash',
  'AOS-Git-Hash': config.aos_git_hash,
  ...config,
})
  .filter(([_, value]) => value !== undefined)
  .map(([name, value]) => ({ name, value }));

const data = createData(wasmBinary, signer, {
  tags: publishingTags,
});
await data.sign(signer);

console.log('Generated WASM Binary data item with id: ' + data.id);

if (!dryRun) {
  console.log('Publishing ANT WASM Binary to Arweave...');
  await turbo.uploadSignedDataItem({
    dataItemSizeFactory: () => data.getRaw().byteLength,
    dataItemStreamFactory: () => data.getRaw(),
  });
}
console.log('Tagged WASM Binary tx id: ' + data.id);
