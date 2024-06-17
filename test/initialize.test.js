const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

describe('AOS-ANT Initialization', async () => {
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

  it('Should initialize the state of the ant', async () => {
    const antState = {
      name: 'Test Process',
      ticker: 'TEST',
      owner: STUB_ADDRESS,
      controllers: [STUB_ADDRESS],
      balances: { [STUB_ADDRESS]: 1 },
      records: {
        '@': {
          transactionId: ''.padEnd(43, '3'),
          ttlSeconds: 3600,
        },
      },
    };
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Initialize-State' }],
      Data: JSON.stringify(antState),
    });
    const { name, ticker, balances, controllers, records } = JSON.parse(
      result.Messages[0].Data,
    );
    assert(name === antState.name);
    assert(ticker === antState.ticker);
    assert.deepEqual(balances, antState.balances);
    assert.deepEqual(controllers, antState.controllers);
    assert.deepEqual(records, antState.records);
  });
});
