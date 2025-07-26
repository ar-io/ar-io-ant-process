import { assertPatchMessage, createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('aos Initialization', async () => {
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

  it('should initialize the state of the ant', async () => {
    const antState = {
      name: 'Test Process',
      ticker: 'TEST',
      description: 'TEST DESCRIPTION',
      keywords: ['KEYWORD-1', 'KEYWORD-2', 'KEYWORD-3'],
      owner: STUB_ADDRESS,
      controllers: [STUB_ADDRESS],
      balances: { [STUB_ADDRESS]: 1 },
      records: {
        '@': {
          transactionId: ''.padEnd(43, '3'),
          ttlSeconds: 900,
        },
      },
    };

    const result = await handle({
      Tags: [{ name: 'Action', value: 'Initialize-State' }],
      Data: JSON.stringify(antState),
    });

    const {
      name,
      ticker,
      description,
      keywords,
      balances,
      controllers,
      records,
    } = JSON.parse(result.Messages[0].Data);

    assert.strictEqual(name, antState.name);
    assert.strictEqual(ticker, antState.ticker);
    assert.strictEqual(description, antState.description);
    assert.deepStrictEqual(keywords, antState.keywords);
    assert.deepEqual(balances, antState.balances);
    assert.deepEqual(controllers, antState.controllers);
    assert.deepEqual(records, antState.records);
    assertPatchMessage(result);
  });
});
