import path from 'path';
import fs from 'fs';
import { bundle } from './lua-bundler.mjs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Bundling Lua...');

  const bundledLua = bundle(path.join(__dirname, '../src/aos.lua'));

  if (!fs.existsSync(path.join(__dirname, '../dist'))) {
    fs.mkdirSync(path.join(__dirname, '../dist'));
  }

  fs.writeFileSync(path.join(__dirname, '../dist/aos-bundled.lua'), bundledLua);
  console.log('Doth Lua hath been bundled!');
}

main();