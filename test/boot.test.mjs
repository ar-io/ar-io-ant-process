import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  AOS_ANT_WASM,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  STUB_ANT_REGISTRY_ID,
} from '../tools/constants.mjs';
import AoLoader from '@permaweb/ao-loader';

describe('BOOT ANT', async () => {
  it('should boot the process with ANT state', async () => {
    const handle = await AoLoader(AOS_ANT_WASM, AO_LOADER_OPTIONS);
    async function getState(mem) {
      return handle(
        mem,
        {
          ...DEFAULT_HANDLE_OPTIONS,
          Tags: [{ name: 'Action', value: 'State' }],
        },
        AO_LOADER_HANDLER_ENV,
      );
    }
    const antState = {
      logo: 'logo'.padEnd(43, '1'),
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

    const result = await handle(
      null,
      {
        ...DEFAULT_HANDLE_OPTIONS,
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
        ],
      },
      AO_LOADER_HANDLER_ENV,
    );

    const messages = result.Messages;
    const stateNotice = messages.find(
      (m) =>
        m.Target === STUB_ANT_REGISTRY_ID &&
        m.Tags.find((t) => t.name == 'Action' && t.value == 'State-Notice'),
    );
    const creditNotice = messages.find((m) => m.Target === STUB_ADDRESS);

    assert(stateNotice, 'no state notice found');
    assert(
      JSON.parse(stateNotice.Data).Name === antState.name,
      'state did not initialize correctly',
    );
    assert(creditNotice, 'no credit notice found');

    const stateRes = await getState(result.Memory);

    const state = JSON.parse(stateRes.Messages[0].Data);

    assert.strictEqual(state.Description, antState.description);
    assert.strictEqual(state.Ticker, antState.ticker);
    assert.strictEqual(state.Name, antState.name);
    assert.strictEqual(state.Owner, antState.owner);
    assert.strictEqual(state.Logo, antState.logo);
    assert.deepEqual(state.Controllers, antState.controllers);
    assert.deepEqual(state.Keywords, antState.keywords);
    assert.deepEqual(state.Balances, antState.balances);
    assert.deepEqual(state.Records, antState.records);
  });

  it('should not initialize state with invalid data', async () => {
    const handle = await AoLoader(AOS_ANT_WASM, AO_LOADER_OPTIONS);
    async function getState(mem) {
      return handle(
        mem,
        {
          ...DEFAULT_HANDLE_OPTIONS,
          Tags: [{ name: 'Action', value: 'State' }],
        },
        AO_LOADER_HANDLER_ENV,
      );
    }
    const result = await handle(
      null,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        Data: 'not valid json',
        Tags: [
          {
            name: 'Type',
            value: 'Process',
          },
          {
            name: 'ANT-Registry-Id',
            value: STUB_ANT_REGISTRY_ID,
          },
        ],
      },
      AO_LOADER_HANDLER_ENV,
    );

    const messages = result.Messages;
    const stateNotice = messages.find(
      (m) =>
        m.Target === STUB_ANT_REGISTRY_ID &&
        m.Tags.find((t) => t.name == 'Action' && t.value == 'State-Notice'),
    );
    const creditNotice = messages.find((m) => m.Target === STUB_ADDRESS);

    const errorNotice = messages.find((m) =>
      m.Tags.find((tag) => tag.name == 'Error'),
    );

    assert(errorNotice, 'no error notice');

    assert(stateNotice, 'no state notice found');
    assert(creditNotice, 'no credit notice found');

    const stateRes = await getState(result.Memory);

    const state = JSON.parse(stateRes.Messages[0].Data);
    assert(state, 'Unable to get ANT state');
  });

  it('should boot ant with no data', async () => {
    const handle = await AoLoader(AOS_ANT_WASM, AO_LOADER_OPTIONS);
    async function getState(mem) {
      return handle(
        mem,
        {
          ...DEFAULT_HANDLE_OPTIONS,
          Tags: [{ name: 'Action', value: 'State' }],
        },
        AO_LOADER_HANDLER_ENV,
      );
    }
    const result = await handle(
      null,
      {
        ...DEFAULT_HANDLE_OPTIONS,

        Tags: [
          {
            name: 'Type',
            value: 'Process',
          },
          {
            name: 'ANT-Registry-Id',
            value: STUB_ANT_REGISTRY_ID,
          },
        ],
      },
      AO_LOADER_HANDLER_ENV,
    );

    const messages = result.Messages;
    const stateNotice = messages.find((m) => m.Target === STUB_ANT_REGISTRY_ID);
    const creditNotice = messages.find((m) => m.Target === STUB_ADDRESS);

    const errorNotice = messages.find((m) =>
      m.Tags.find((tag) => tag.name == 'Error'),
    );

    assert(!errorNotice, 'There was an error notice');

    assert(stateNotice, 'no state notice found');
    assert(creditNotice, 'no credit notice found');

    const stateRes = await getState(result.Memory);

    const state = JSON.parse(stateRes.Messages[0].Data);
    assert(state, 'Unable to get ANT state');
  });
});
