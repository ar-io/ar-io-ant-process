import { HB } from 'wao';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jwk = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8'),
);

console.log('Spawning Hyper-ANT...\n\n');

const hb = await new HB({
  url: 'https://forward.computer',
  cu: 'https://cu.ardrive.io',
  jwk: jwk,
}).init(jwk);
await hb.setInfo();

console.dir(hb, { depth: null });

// console.log('Testing aos spawn...');
// const aosPid = await hb.spawnAOS();
// console.log('AOS Process ID: \n\n', aosPid, '\n\n');

const { pid } = await hb.spawnLua(
  'YptRLfVUrTQZ79umL-yayqpTjwvHGFBeNB5Ugizz2XE',
);

console.log('Hyper-ANT Process ID: \n\n', pid, '\n\n');

const stateResult = await hb.messageAOS({
  pid,
  tags: [{ name: 'Action', value: 'State' }],
  data: '',
});
console.log('Hyper-ANT State Result:\n\n');
console.dir(stateResult, { depth: null });
