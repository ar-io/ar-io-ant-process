const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

describe('aos Controllers', async () => {
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

  it('should get the controllers', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Controllers' }],
    });

    const controllers = JSON.parse(result.Messages[0].Data);
    assert(controllers);
    assert(controllers.includes(STUB_ADDRESS));
  });

  it('should add the controller', async () => {
    const controller = ''.padEnd(43, '2');
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: controller },
      ],
    });

    assert(JSON.parse(result.Messages[0].Data).includes(controller), true);
  });

  it('should remove the controller', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Remove-Controller' },
        { name: 'Controller', value: STUB_ADDRESS },
      ],
    });
    assert(result);

    const addControllerResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: STUB_ADDRESS },
        ],
      },
      result.Memory,
    );
    assert.equal(
      JSON.parse(addControllerResult.Messages[0].Data).includes(STUB_ADDRESS),
      true,
    );
  });
});
