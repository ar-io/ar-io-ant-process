import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('Registry Updates', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  const controllerAddress = 'controller-address'.padEnd(43, '0');

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

  it('should send update to registry when a controller is added', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: controllerAddress },
      ],
    });

    const message = result.Messages[0]?.Tags.find(
      (tag) => tag.name === 'Action' && tag.value === 'Add-Controller-Notice',
    );
    assert(message, 'Add-Controller-Notice message not found');

    const notifyMessage = result.Messages[1]?.Tags.find(
      (tag) => tag.name === 'Action' && tag.value === 'State-Notice',
    );

    assert(notifyMessage, 'State-Notice message not found');
  });

  it('should send update to registry when a controller is removed', async () => {
    await handle({
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: controllerAddress },
      ],
    });

    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Remove-Controller' },
        { name: 'Controller', value: controllerAddress },
      ],
    });

    const message = result.Messages[0]?.Tags.find(
      (tag) =>
        tag.name === 'Action' && tag.value === 'Remove-Controller-Notice',
    );
    assert(message, 'Remove-Controller-Notice message not found');

    const notifyMessage = result.Messages[1]?.Tags.find(
      (tag) => tag.name === 'Action' && tag.value === 'State-Notice',
    );
    assert(notifyMessage, 'State-Notice message not found');
  });

  it('should send update to registry when ANT is transferred', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: controllerAddress },
      ],
      From: STUB_ADDRESS,
    });

    const message = result.Messages[1]?.Tags.find(
      (tag) => tag.name === 'Action' && tag.value === 'Credit-Notice',
    );
    assert(message, 'Credit-Notice message not found');

    const notifyMessage = result.Messages[2]?.Tags.find(
      (tag) => tag.name === 'Action' && tag.value === 'State-Notice',
    );
    assert(notifyMessage, 'State-Notice message not found');
  });
});
