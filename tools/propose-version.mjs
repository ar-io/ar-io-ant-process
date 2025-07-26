import path, { dirname } from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import version from '../version.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TX_ID_REGEX = new RegExp('^[a-zA-Z0-9\\-_s+]{43}$');

/*
example dryrun

yarn propose-version \
--dry-run \
--ant-registry RR0vheYqtsKuJCWh6xj0beE35tjaEug5cejMw9n2aa8 \
--vaot-id 4Ko7JmGPtbKLLqctNFr6ukWqX0lt4l0ktXgYKyMlbsM \
--module pb4fCvdJqwT-_bn38ERMdqnOF4weRMjoJ6bY6yfl4a8 \
--lua-source OO2ewZKq4AHoqGQmYUIl-NhJ-llQyFJ3ha4Uf4-w5RI

*/

function getLatestChanges() {
  const content = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), {
    encoding: 'utf-8',
  });

  const match = content.match(/## \[\d+\].*?\n(.*?)(?=\n## \[\d+\])/s);

  if (match && match[1]) {
    // Trim and remove empty lines
    return match[1].trim();
  }
}

const dryRun =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

const registryId =
  process.env.REGISTRY_ID ??
  process.argv[process.argv.indexOf('--ant-registry') + 1];
const vaotId =
  process.env.VAOT_ID ?? process.argv[process.argv.indexOf('--vaot-id') + 1];
const moduleId =
  process.env.MODULE_ID ?? process.argv[process.argv.indexOf('--module') + 1];
const luaSourceId =
  process.env.LUA_SOURCE_ID ??
  process.argv[process.argv.indexOf('--lua-source') + 1];

const requiredIds = [registryId, vaotId, moduleId];
// Validate required parameters
if (!requiredIds.every((id) => TX_ID_REGEX.test(id))) {
  console.error('Missing required parameters!');
  console.log(
    JSON.stringify(
      {
        registryId,
        moduleId,
        vaotId,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const notes = getLatestChanges();

const walletPath = process.argv.includes('--wallet-file')
  ? process.argv[process.argv.indexOf('--wallet-file') + 1]
  : process.env.WALLET_PATH || path.join(__dirname, 'key.json');

const jwk = process.env.WALLET
  ? JSON.parse(process.env.WALLET)
  : JSON.parse(fs.readFileSync(walletPath, 'utf-8'));

const signer = createDataItemSigner(jwk);

const ao = connect({
  CU_URL: 'https://cu.ardrive.io',
});

const proposalEvalStr = `
    Send({
        Action = "Add-Version",
        Target = "${registryId}",
        Version = "${version}",
        ["Module-Id"] = "${moduleId}",
        ${luaSourceId ? `["Lua-Source-Id"] = "${luaSourceId}",` : ''}
        ${
          notes // the [[]] syntax allows for multiline lua strings
            ? `Notes = [[${notes}]]`
            : ''
        }
    })
  `;

if (dryRun) {
  console.log('Would have proposed to Eval: \n');
  console.log(proposalEvalStr);
  process.exit('0');
}

const proposalResult = await ao.message({
  process: vaotId,
  tags: [
    { name: 'Action', value: 'Propose' },
    { name: 'Proposal-Type', value: 'Eval' },
    { name: 'Vote', value: 'yay' },
    { name: 'Process-Id', value: vaotId },
  ],
  data: proposalEvalStr,
  signer,
});
if (!proposalResult || typeof proposalResult !== 'string')
  throw new Error('Failed to create proposal');
console.log(`Proposal result: ${JSON.stringify(proposalResult)}`);
