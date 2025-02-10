import { createAntAosLoader, createHandleWrapper } from './utils.mjs';
import { describe, it } from 'node:test';
import { AOS_ANT_OLD_WASM } from '../tools/constants.mjs';
import assert from 'node:assert';

describe('JSON limits', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  const handle = createHandleWrapper(originalHandle, startMemory);

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

  it('should be able to parse a large json', async () => {
    console.log('parsing data size: ' + data.length);
    const result = await handle({
      Data: data,
      Tags: [{ name: 'Content-Type', value: 'application/json' }],
    });
  });

  it('should not be able to parse a larger json on old ANT module', async () => {
    const { handle: tempOriginalHandle, memory: tempStartMemory } =
      await createAntAosLoader(AOS_ANT_OLD_WASM);

    const tempHandle = createHandleWrapper(tempOriginalHandle, tempStartMemory);
    console.log('parsing data size: ' + data.length);
    const result = await tempHandle({
      Data: data,
      Tags: [{ name: 'Content-Type', value: 'application/json' }],
    }).catch((e) => new Error(e));

    assert(result instanceof Error, 'should have thrown an error due to size');
  });
});
