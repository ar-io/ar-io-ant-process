import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
} from '../tools/constants.mjs';

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

  it('should be able to parse a large json', async () => {
    const records = {};
    const controllers = [];
    const balances = {};
    for (let i = 0; i < 10_000; i++) {
      records[`${i}-name`] = {
        transactionId: ''.padEnd(43, '1'),
        ttlSeconds: 900,
      };
      const controller = ''.padEnd(43, i.toString());
      controllers.push(controller);
      balances[controller] = 1;
    }
    const data = JSON.stringify({
      records,
      controllers,
      balances,
    });
    console.log('parsing data size: ' + data.length);
    const result = await handle({
      Data: data,
      Tags: [{ name: 'Content-Type', value: 'application/json' }],
    });

    console.dir(result, { depth: null });
  });
});
