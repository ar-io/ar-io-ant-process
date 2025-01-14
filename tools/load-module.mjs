import AoLoader from '@permaweb/ao-loader';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  DEFAULT_HANDLE_OPTIONS,
} from './constants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const wasmBinary = fs.readFileSync(
    path.join(__dirname, '../dist/aos-ant.wasm'),
  );
  // Create the handle function that executes the Wasm
  const handle = await AoLoader(wasmBinary, AO_LOADER_OPTIONS);

  const result = await handle(
    null,
    {
      ...DEFAULT_HANDLE_OPTIONS,
      Tags: [{ name: 'Action', value: 'Info' }],
    },
    AO_LOADER_HANDLER_ENV,
  );

  console.log(
    `\nModule initial memory: ${result.Memory.length / 1024 / 1024} MB`,
  );
}
main();
