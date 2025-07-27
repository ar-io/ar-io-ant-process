import { createAntAosLoader, assertPatchMessage } from './utils.mjs';
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

  describe('Authorization Tests', () => {
    const UNAUTHORIZED_ADDRESS = 'unauthorized-address-'.padEnd(43, '9');

    it('should fail to set name when called by non-owner/non-controller', async () => {
      const setNameResult = await handle({
        From: UNAUTHORIZED_ADDRESS,
        Owner: UNAUTHORIZED_ADDRESS,
        Tags: [
          { name: 'Action', value: 'Set-Name' },
          { name: 'Name', value: 'Unauthorized Name' },
        ],
      });

      // Should return an error message and patch message
      assert.strictEqual(
        setNameResult.Messages?.length,
        2,
        'Expected 2 messages',
      );
      const errorMessage = setNameResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Name-Error',
        'Expected Set-Name-Error tag in response',
      );
      assertPatchMessage(setNameResult);

      // Verify the name was not actually changed
      const infoResult = await handle(
        {
          Tags: [{ name: 'Action', value: 'Info' }],
        },
        setNameResult.Memory,
      );
      const info = JSON.parse(infoResult.Messages[0].Data);
      assert(
        info.Name !== 'Unauthorized Name',
        'Name should not be changed by unauthorized user',
      );
    });

    it('should fail to set ticker when called by non-owner/non-controller', async () => {
      const setTickerResult = await handle({
        From: UNAUTHORIZED_ADDRESS,
        Owner: UNAUTHORIZED_ADDRESS,
        Tags: [
          { name: 'Action', value: 'Set-Ticker' },
          { name: 'Ticker', value: 'HACK' },
        ],
      });

      // Should return an error message and patch message
      assert.strictEqual(
        setTickerResult.Messages?.length,
        2,
        'Expected 2 messages',
      );
      const errorMessage = setTickerResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Ticker-Error',
        'Expected Set-Ticker-Error tag in response',
      );
      assertPatchMessage(setTickerResult);

      // Verify the ticker was not actually changed
      const infoResult = await handle(
        {
          Tags: [{ name: 'Action', value: 'Info' }],
        },
        setTickerResult.Memory,
      );
      const info = JSON.parse(infoResult.Messages[0].Data);
      assert(
        info.Ticker !== 'HACK',
        'Ticker should not be changed by unauthorized user',
      );
    });

    it('should fail to set description when called by non-owner/non-controller', async () => {
      const setDescriptionResult = await handle({
        From: UNAUTHORIZED_ADDRESS,
        Owner: UNAUTHORIZED_ADDRESS,
        Tags: [
          { name: 'Action', value: 'Set-Description' },
          { name: 'Description', value: 'Unauthorized Description' },
        ],
      });

      // Should return an error message and patch message
      assert.strictEqual(
        setDescriptionResult.Messages?.length,
        2,
        'Expected 2 messages',
      );
      const errorMessage = setDescriptionResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Description-Error',
        'Expected Set-Description-Error tag in response',
      );
      assertPatchMessage(setDescriptionResult);

      // Verify the description was not actually changed
      const infoResult = await handle(
        {
          Tags: [{ name: 'Action', value: 'Info' }],
        },
        setDescriptionResult.Memory,
      );
      const info = JSON.parse(infoResult.Messages[0].Data);
      assert(
        info.Description !== 'Unauthorized Description',
        'Description should not be changed by unauthorized user',
      );
    });

    it('should fail to set keywords when called by non-owner/non-controller', async () => {
      const unauthorizedKeywords = ['hack', 'malicious', 'unauthorized'];
      const setKeywordsResult = await handle({
        From: UNAUTHORIZED_ADDRESS,
        Owner: UNAUTHORIZED_ADDRESS,
        Tags: [
          { name: 'Action', value: 'Set-Keywords' },
          { name: 'Keywords', value: JSON.stringify(unauthorizedKeywords) },
        ],
      });

      // Should return an error message and patch message
      assert.strictEqual(
        setKeywordsResult.Messages?.length,
        2,
        'Expected 2 messages',
      );
      const errorMessage = setKeywordsResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Keywords-Error',
        'Expected Set-Keywords-Error tag in response',
      );
      assertPatchMessage(setKeywordsResult);

      // Verify the keywords were not actually changed
      const infoResult = await handle(
        {
          Tags: [{ name: 'Action', value: 'Info' }],
        },
        setKeywordsResult.Memory,
      );
      const info = JSON.parse(infoResult.Messages[0].Data);
      assert(
        !info.Keywords.some((keyword) =>
          unauthorizedKeywords.includes(keyword),
        ),
        'Keywords should not be changed by unauthorized user',
      );
    });
  });
});
