import { createSigner, connect } from '@permaweb/aoconnect';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AO_AUTHORITY } from '@ar.io/sdk';

const AO_PROTO_MAP = {
  DEVICES: {
    process: 'process@1.0',
    scheduler: 'scheduler@1.0',
    push: 'push@1.0',
    lua: 'lua@5.3a',
  },
  TAGS: {
    ['data-protocol']: 'ao',
    variant: 'ao.TN.1',
    random: Math.random().toString(),
    ['signing-format']: 'ANS-104',
    accept: 'application/json',
  },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jwk = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8'),
);

const signer = createSigner(jwk);
const hyperAntModuleId = 'CiOsHx68AAuyEf5tC3qJX1WXlz1O_3q_niWLL-tBTIE';
const antRegistryId = 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';
const hbUrl = 'https://scheduler.forward.computer';
const gatewayUrl = 'https://arweave.net';
const cuUrl = 'https://cu.ardrive.io';

// HB node operator must be in the authorities
// Scheduler must be the HB node operator
async function spawnHyperProcess({
  authorities = [AO_AUTHORITY],
  tags = {},
  module = hyperAntModuleId,
  scheduler,
  data,
}) {
  const ao = connect({
    MODE: 'mainnet',
    URL: hbUrl,
    GATEWAY_URL: gatewayUrl,
    signer: signer,
    device: AO_PROTO_MAP.DEVICES.process,
  });

  const params = {
    ...AO_PROTO_MAP.TAGS,
    ...tags,
    path: '/push',
    method: 'POST',
    type: 'Process',
    device: AO_PROTO_MAP.DEVICES.process,
    ['push-device']: AO_PROTO_MAP.DEVICES.push,
    ['scheduler-device']: AO_PROTO_MAP.DEVICES.scheduler,
    ['execution-device']: AO_PROTO_MAP.DEVICES.lua,
    authority: authorities.join(','),
    module,
    scheduler,
  };

  if (data) {
    params.data = data;
  }
  console.log('Spawning Hyper-ANT with params: \n\n');
  console.dir(params, { depth: null });

  const result = await ao.request(params);

  return result;
}

async function getOperatorAddress(url) {
  const hashpath = url + '/~meta@1.0/info/address';
  const res = await fetch(hashpath);
  const scheduler = (await res.text()).trim();
  return scheduler;
}

async function main() {
  console.log('Starting Hyper-ANT spawner with config: \n\n');
  console.log('HB URL: ' + hbUrl);
  console.log('Gateway URL: ' + gatewayUrl);
  console.log('CU URL: ' + cuUrl);
  console.log('Hyper-ANT ID: ' + hyperAntModuleId);
  console.log('Signer: ' + signer);
  console.log('Authorities: ' + AO_AUTHORITY);
  const ao = connect({
    MODE: 'mainnet',
    URL: hbUrl,
    GATEWAY_URL: gatewayUrl,
    signer: signer,
    device: AO_PROTO_MAP.DEVICES.process,
  });

  console.log('Getting operator address...');
  const operatorAddress = await getOperatorAddress(hbUrl);
  console.log('Operator address found: ' + operatorAddress + '\n');

  const result = await spawnHyperProcess({
    authorities: [operatorAddress, AO_AUTHORITY],
    scheduler: operatorAddress,
    module: hyperAntModuleId,
    tags: { ['ant-registry-id']: antRegistryId },
  });
  if (result.process) {
    console.log('Hyper-ANT spawned with id: ' + result.process + '\n');
  } else {
    console.log('Hyper-ANT failed to spawn: ' + result.error + '\n');
    console.error(result, { depth: null });
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
