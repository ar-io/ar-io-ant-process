import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  BUNDLED_AOS_ANT_LUA,
} from '../tools/constants.mjs';

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

  it('should evolve the ant and retain eval ability', async () => {
    const srcCodeTxIdStub = 'new-source-code-tx-id-'.padEnd(43, '-1');
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
    const state = JSON.parse(result.Messages[0].Data);
    assert(state);
    assert(state['Source-Code-TX-ID'] === srcCodeTxIdStub);

    const evalResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: 'Handlers.list',
      },
      evolveResult.Memory,
    );

    assert(evalResult.Output.data.output);
    assert(evalResult.Output.data.output.includes('evolve'));
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

  it('should not evolve the ant with correct tags called by a non owner', async () => {
    const srcCodeTxIdStub = ''.padEnd(43, '123-test');
    const evolveResult = await handle({
      Tags: [
        { name: 'Action', value: 'Eval' },
        { name: 'Source-Code-TX-ID', value: srcCodeTxIdStub },
      ],
      Data: BUNDLED_AOS_ANT_LUA,
      Owner: 'im-not-the-owner-'.padEnd(43, 'a'),
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
