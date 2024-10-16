import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import fs from 'fs';
import path from 'path';
import Arweave from 'arweave';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

const ao = connect({
  GATEWAY_URL: 'https://arweave.net',
});
const moduleId = 'cbn0KKrBZH7hdNkNokuXLtGryrWM--PjSTBqIzw9Kkk';
const scheduler = '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA';

async function main() {
  const luaCode = fs.readFileSync(
    path.join(__dirname, '../dist/aos-bundled.lua'),
    'utf-8',
  );

  const wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
  const address = await arweave.wallets.jwkToAddress(JSON.parse(wallet));
  const signer = createDataItemSigner(JSON.parse(wallet));

  const initState = JSON.stringify({
    balances: { [address]: 1 },
    controllers: [address],
    name: 'ANT-ARDRIVE',
    owner: address,
    records: {
      '@': {
        transactionId: 'UyC5P5qKPZaltMmmZAWdakhlDXsBF6qmyrbWYFchRTk',
        ttlSeconds: 3600,
      },
    },
    ticker: 'ANT',
    description: 'Description for this ANT.',
    keywords: ['KEYWORD-1', 'KEYWORD-2', 'KEYWORD-3'],
  });

  const processId = await ao.spawn({
    module: moduleId,
    scheduler,
    signer,
  });

  console.log('Process ID:', processId);
  console.log('Waiting 20 seconds to ensure process is readied.');
  await new Promise((resolve) => setTimeout(resolve, 20_000));
  console.log('Loading ANT Lua code...');

  const testCases = [
    ['Eval', {}, luaCode],
    ['Initialize-State', {}, initState],
    ['Transfer', { Recipient: 'N4h8M9A9hasa3tF47qQyNvcKjm4APBKuFs7vqUVm-SI' }],
  ];

  for (const [method, args, data] of testCases) {
    const tags = args
      ? Object.entries(args).map(([key, value]) => ({ name: key, value }))
      : [];
    const result = await ao
      .message({
        process: processId,
        tags: [...tags, { name: 'Action', value: method }],
        data,
        signer,
        Owner: address,
        From: address,
      })
      .catch((e) => e);

    console.dir({ method, result }, { depth: null });
  }
}

main();
