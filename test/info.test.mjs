import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
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
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Info' }],
    });

    const processInfo = JSON.parse(result.Messages[0].Data);
    assert(processInfo.Name);
    assert(processInfo.Ticker);
    assert(processInfo.Description);
    assert(processInfo.Keywords);
    assert(processInfo['Total-Supply']);
    assert(processInfo.Denomination !== undefined);
    assert(processInfo.Logo);
    assert(processInfo.Owner);
    assert(processInfo.Handlers);
    assert.deepStrictEqual(processInfo.Handlers, [
      '_bootAnt',
      '_boot',
      '_eval',
      '_default',
      'transfer',
      'balance',
      'balances',
      'totalSupply',
      'info',
      'addController',
      'removeController',
      'controllers',
      'setRecord',
      'removeRecord',
      'record',
      'records',
      'setName',
      'setTicker',
      'setDescription',
      'setKeywords',
      'setLogo',
      'initializeState',
      'state',
      'releaseName',
      'reassignName',
      'approvePrimaryName',
      'removePrimaryNames',
    ]);
  });

  it('should set the name of the process', async () => {
    const setNameResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Name' },
        { name: 'Name', value: 'Test Process' },
      ],
    });

    const infoResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      setNameResult.Memory,
    );
    const info = JSON.parse(infoResult.Messages[0].Data);
    assert(info.Name === 'Test Process');
  });

  it('should set the ticker of the process', async () => {
    const setTickerResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Ticker' },
        { name: 'Ticker', value: 'TEST' },
      ],
    });

    const infoResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      setTickerResult.Memory,
    );
    const info = JSON.parse(infoResult.Messages[0].Data);
    assert(info.Ticker === 'TEST');
  });

  it('should set the description of the process', async () => {
    const setDescriptionResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Description' },
        { name: 'Description', value: 'NEW DESCRIPTION' },
      ],
    });

    const infoResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      setDescriptionResult.Memory,
    );
    const info = JSON.parse(infoResult.Messages[0].Data);
    assert(info.Description === 'NEW DESCRIPTION');
  });

  it('should set the keywords of the process', async () => {
    const setKeywordsResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Keywords' },
        {
          name: 'Keywords',
          value: JSON.stringify(['keyword1', 'keyword2', 'keyword3']),
        },
      ],
    });

    // Assuming an 'Info' action retrieves the current state of the process
    const infoResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      setKeywordsResult.Memory, // Use the updated memory from the setKeywordsResult
    );

    const info = JSON.parse(infoResult.Messages[0].Data);
    assert.deepEqual(
      info.Keywords,
      ['keyword1', 'keyword2', 'keyword3'],
      'Keywords do not match expected values',
    );
  });

  it('should get state', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'State' }],
    });

    const state = JSON.parse(result.Messages[0].Data);
    assert(state);
    assert(state.Balances);
    assert(state.Records);
    assert(state.Controllers);
    assert(state.Owner);
    assert(state.Ticker);
    assert(state.Description);
    assert(state.Keywords);
    assert(state.Name);
  });
});
