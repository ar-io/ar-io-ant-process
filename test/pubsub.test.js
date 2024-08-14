const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

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
    console.dir(topicsResult);
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
        Data: JSON.stringify(topics),
      },
      topicsResult.Memory,
    );

    console.dir(subscribeResult, { depth: null });
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
  });
});
