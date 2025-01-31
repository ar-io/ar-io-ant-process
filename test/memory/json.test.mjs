import { createAntAosLoader } from '../utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
} from '../../tools/constants.mjs';

describe('JSON limits', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  async function handle(options = {}, mem = startMemory) {
    return originalHandle(
      mem,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...options,
      },
      AO_LOADER_HANDLER_ENV,
    );
  }

  it('should not be able to parse a large json', async () => {
    const data = JSON.stringify(
      new Array(1).fill({
        transactionId: ''.padEnd(43, '1'),
        ttlSeconds: 3600,
        name: '@',
      }),
    );
    console.log('parsing data size: ' + data.length);
    const result = await handle({
      Data: data,
      Tags: [{ name: 'Content-Type', value: 'application/json' }],
    });

    console.dir(result, { depth: null });
  });
});
