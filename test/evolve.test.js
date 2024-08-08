const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  BUNDLED_AOS_ANT_LUA,
} = require('../tools/constants');

describe('aos Evolve', async () => {
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

  it('should evolve the ant', async () => {
    const srcCodeTxIdStub = ''.padEnd(43, '123-test');
    const evolveResult = await handle({
      Tags: [
        { name: 'Action', value: 'Eval' },
        { name: 'Source-Code-TX-ID', value: srcCodeTxIdStub },
      ],
      Data: BUNDLED_AOS_ANT_LUA,
    });

    const result = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      evolveResult.Memory,
    );
    console.dir(result, { depth: null });
    const state = JSON.parse(result.Messages[0].Data);
    assert(state);
    assert(state['Source-Code-TX-ID'] === srcCodeTxIdStub);
  });

  it('should not evolve the ant', async () => {
    const evolveResult = await handle({
      Tags: [
        { name: 'Action', value: 'Eval' },
        // omit src code id
      ],
      Data: BUNDLED_AOS_ANT_LUA,
    });

    const result = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      evolveResult.Memory,
    );

    const state = JSON.parse(result.Messages[0].Data);
    assert(state);
    assert(state['Source-Code-TX-ID'] === '__INSERT_SOURCE_CODE_ID__');
  });
});
