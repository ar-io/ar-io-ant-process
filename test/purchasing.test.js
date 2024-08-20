const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

describe('purchasing', async () => {
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
  it('should set price settings', async () => {
    const setPriceSettingsResult = await handle({
      Tags: [
        {
          name: 'Action',
          value: 'Set-Price-Settings',
        },
      ],
      Data: JSON.stringify({
        apexRecord: {
          price: 10,
        },
      }),
    });
    assert(
      setPriceSettingsResult.Messages[0].Tags.find((t) => t.name === 'Action')
        .value === 'Set-Price-Settings-Notice',
    );

    const getPriceSettingsResult = await handle(
      {
        Tags: [
          {
            name: 'Action',
            value: 'Get-Price-Settings',
          },
        ],
      },
      setPriceSettingsResult.Memory,
    );

    const settings = JSON.parse(getPriceSettingsResult.Messages[0].Data);
    assert(settings.defaults.apexRecord.price === 10);
  });

  it('should get price settings', async () => {
    const getPriceSettingsResult = await handle({
      Tags: [
        {
          name: 'Action',
          value: 'Get-Price-Settings',
        },
      ],
    });

    const settings = JSON.parse(getPriceSettingsResult.Messages[0].Data);
    assert(settings.defaults.apexRecord.price !== undefined);
  });

  it('should add a token to whitelist', async () => {
    const addTokenResult = await handle({
      Tags: [
        {
          name: 'Action',
          value: 'Set-Token-Settings',
        },
        {
          name: 'Token-Id',
          value: 'token-id'.padEnd(43, '0'),
        },
      ],
      Data: JSON.stringify({
        tokenRate: 10,
      }),
    });

    assert(
      addTokenResult.Messages[0].Tags.find((t) => t.name === 'Action').value ===
        'Info',
    );
    assert(
      addTokenResult.Messages[1].Tags.find((t) => t.name === 'Action').value ===
        'Set-Token-Settings-Notice',
    );

    const tokenSettingsResult = await handle(
      {
        Tags: [
          {
            name: 'Action',
            value: 'Get-Price-Settings',
          },
        ],
      },
      addTokenResult.Memory,
    );
    const tokSet = JSON.parse(tokenSettingsResult.Messages[0].Data);

    assert(
      tokSet.whiteListedTokens['token-id'.padEnd(43, '0')].tokenRate === 10,
    );
  });

  it('should buy an undername and send tax and profits and subscribe and refund overspend', async () => {
    const buyUndernameResult = await handle({
      From: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
      Owner: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
      Tags: [
        { name: 'Action', value: 'Credit-Notice' },
        { name: 'Quantity', value: 10 * 10 ** 18 },
        { name: 'Sender', value: STUB_ADDRESS },
        { name: 'X-Action', value: 'X-Buy-Record' },
        { name: 'X-Undername', value: 'ardrive' },
        { name: 'X-Under-ANT-ID', value: 'under-ant-id'.padEnd(43, '0') },
        { name: 'X-Purchase-Type', value: 'buy' },
      ],
    });
    console.dir(buyUndernameResult, { depth: null });
    // tax message sending io to the protocol balance
    assert(
      buyUndernameResult.Messages[0].Tags.find((t) => t.name === 'Action')
        .value === 'Transfer',
    );
    // profit sharing sending profits to owner
    assert(
      buyUndernameResult.Messages[1].Tags.find((t) => t.name === 'Action')
        .value === 'Transfer',
    );
    // refund overspend
    assert(
      buyUndernameResult.Messages[2].Tags.find((t) => t.name === 'Action')
        .value === 'Transfer',
    );
    assert(
      buyUndernameResult.Messages[2].Tags.find((t) => t.name === 'Recipient')
        .value === STUB_ADDRESS,
    );
    // subscribe message subscribing to the under ant
    assert(
      buyUndernameResult.Messages[3].Tags.find((t) => t.name === 'Action')
        .value === 'Add-Subscriber',
    );

    // check record was set
    const recordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Record' },
          { name: 'Sub-Domain', value: 'ardrive' },
        ],
      },
      buyUndernameResult.Memory,
    );
    console.dir(recordResult, { depth: null });
    assert(recordResult.Messages[0].Data);
  });
});
