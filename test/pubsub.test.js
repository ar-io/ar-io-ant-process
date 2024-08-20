const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

// aos testing copy pastas

/**
 * Send({ Target = ao.id, Action = "Add-Subscriber", Subscriber = "7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk", Data = require("json").encode({"Records"}) })
 * Send({ Target = ao.id, Action = "Set-Record", ["Sub-Domain"] = "@", ["Transaction-Id"] = "7waR8v4STuwPnTck1zFVkQqJh5K9q9Zik4Y5-5dV7nk", ["TTL-Seconds"] = 3000  })
 */

describe('pubsub', async () => {
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
  it('should subscribe to available topics', async () => {
    // get topics
    const topicsResult = await handle({
      Tags: [{ name: 'Action', value: 'Get-Topics' }],
    });

    const topics = JSON.parse(topicsResult.Messages[0].Data);
    assert(topics.length > 0);
    assert(topics.includes('Records'));
    assert(topics.includes('Controllers'));
    assert(topics.includes('Balances'));
    assert(topics.includes('Handlers'));

    // subscribe to topics
    const subscribeResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Add-Subscriber' },
          { name: 'Subscriber', value: STUB_ADDRESS },
        ],
        Data: JSON.stringify(['Records']),
      },
      topicsResult.Memory,
    );

    const subscriberNotice = subscribeResult.Messages[0].Data;
    assert(subscriberNotice == 'Success');

    const subscribedTopicsResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Get-Subscriber-Topics' },
          { name: 'Subscriber', value: STUB_ADDRESS },
        ],
      },
      subscribeResult.Memory,
    );
    console.dir(subscribedTopicsResult, { depth: null });

    const subscribedTopics = JSON.parse(
      subscribedTopicsResult.Messages[0].Data,
    );
    assert(subscribedTopics.every((topic) => topics.includes(topic)));

    const subscribersResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Get-Subscribers' }],
      },
      subscribeResult.Memory,
    );

    const setRecordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: '@' },
          { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
          { name: 'TTL-Seconds', value: 3600 },
        ],
      },
      subscribersResult.Memory,
    );
    console.dir(setRecordResult, { depth: null });
    const publishData = setRecordResult.Messages[1].Data;
    assert(JSON.parse(publishData)['@'] !== undefined);
    assert(
      setRecordResult.Messages[1].Tags.find((t) => t.name === 'Action')
        .value === 'Publish',
    );
  });
});
