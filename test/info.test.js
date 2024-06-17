const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

describe('AOS-ANT Info', async () => {
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

  it('Should get the process info', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Info' }],
    });

    const processInfo = JSON.parse(result.Messages[0].Data);
    assert(processInfo.Name);
    assert(processInfo.Ticker);
    assert(processInfo['Total-Supply']);
    assert(processInfo.Denomination !== undefined);
    assert(processInfo.Logo);
    assert(processInfo.Owner);
  });

  it('Should set the name of the process', async () => {
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

  it('Should set the ticker of the process', async () => {
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
});
