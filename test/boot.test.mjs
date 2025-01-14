import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  STUB_ANT_REGISTRY_ID,
} from '../tools/constants.mjs';

describe('aos Info', async () => {
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

  it('should get the process info', async () => {
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
          ttlSeconds: 3600,
        },
      },
    };
    const result = await handle({
      Data: JSON.stringify(antState),
      Tags: [
        {
          name: 'Type',
          value: 'Process',
        },
        {
          name: 'ANT-Registry-Id',
          value: STUB_ANT_REGISTRY_ID,
        },
        {
          name: 'Initialize-State',
          value: 'true',
        },
      ],
    });

    const messages = result.Messages;
    const stateNotice = messages.find((m) => m.Target === STUB_ANT_REGISTRY_ID);
    const creditNotice = messages.find((m) => m.Target === STUB_ADDRESS);

    assert(stateNotice, 'no state notice found');
    assert(
      JSON.parse(stateNotice.Data).Name === antState.name,
      'state did not initialize correctly',
    );
    assert(creditNotice, 'no credit notice found');
  });
});
