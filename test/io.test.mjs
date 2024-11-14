import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('IO Network Updates', async () => {
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

  it('should send update to io network when a name is released', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Release-Name' },
        { name: 'IO-Process-Id', value: 'io-process-id-'.padEnd(43, '1') },
        { name: 'Name', value: 'name' },
      ],
    });

    // two messages should be sent - one to the io process and one to the sender
    assert(result.Messages?.length === 2, 'Expected two messages');

    // Check if there is a message to the IO Process ID with Action 'Release-Name'
    const ioProcessMessage = result.Messages.find(
      (msg) =>
        msg.Target === 'io-process-id-'.padEnd(43, '1') &&
        msg.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Release-Name',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
        ) &&
        msg.Tags.some((tag) => tag.name === 'Name' && tag.value === 'name'),
    );
    assert(ioProcessMessage, 'Message to IO Process not found');

    // Check if there is a message to the sender with Action 'Release-Name-Notice'
    const senderMessage = result.Messages.find(
      (msg) =>
        msg.Target === STUB_ADDRESS &&
        msg.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Release-Name-Notice',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
        ) &&
        msg.Tags.some((tag) => tag.name === 'Name' && tag.value === 'name'),
    );
    assert(senderMessage, 'Message to Sender not found');
  });

  it('should send a release-name-error-notice if the sender is not the owner', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Release-Name' },
        { name: 'IO-Process-Id', value: 'io-process-id' },
        { name: 'Name', value: 'name' },
      ],
      From: 'not-owner',
      Owner: 'not-owner',
    });

    // assert no other messages
    assert(result.Messages?.length === 1, 'Expected only one message');

    const error = result.Messages[0]?.Tags.find(
      (tag) => tag.name === 'Error' && tag.value === 'Release-Name-Error',
    );
    assert(error, 'Release-Name-Error message not found');
  });

  it('should send updates to IO network when a name is reassigned', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Reassign-Name' },
        { name: 'IO-Process-Id', value: 'io-process-id-'.padEnd(43, '1') },
        { name: 'Name', value: 'test-name' },
        { name: 'Process-Id', value: STUB_ADDRESS },
      ],
    });

    // two messages should be sent - one to the io process and one to the sender
    assert(result.Messages?.length === 2, 'Expected two messages');

    // Check if there is a message to the IO Process ID with Action 'Reassign-Name'
    const ioProcessMessage = result.Messages.find(
      (msg) =>
        msg.Target === 'io-process-id-'.padEnd(43, '1') &&
        msg.Tags.some(
          (tag) => tag.name === 'Action' && tag.value === 'Reassign-Name',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Name' && tag.value === 'test-name',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Process-Id' && tag.value === STUB_ADDRESS,
        ),
    );
    assert(ioProcessMessage, 'Message to IO Process not found');

    // Check if there is a message to the sender with Action 'Reassign-Name-Notice'
    const senderMessage = result.Messages.find(
      (msg) =>
        msg.Target === STUB_ADDRESS &&
        msg.Tags.some(
          (tag) =>
            tag.name === 'Action' && tag.value === 'Reassign-Name-Notice',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Name' && tag.value === 'test-name',
        ) &&
        msg.Tags.some(
          (tag) => tag.name === 'Process-Id' && tag.value === STUB_ADDRESS,
        ),
    );
    assert(senderMessage, 'Message to Sender not found');
  });

  it('should send a reassign-name-error-notice if the sender is not the owner', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Reassign-Name' },
        { name: 'IO-Process-Id', value: 'io-process-id' },
        { name: 'Name', value: 'name' },
        { name: 'Process-Id', value: STUB_ADDRESS },
      ],
      From: 'not-owner',
      Owner: 'not-owner',
    });

    // assert no other messages
    assert(result.Messages?.length === 1, 'Expected only one message');

    const error = result.Messages[0]?.Tags.find(
      (tag) => tag.name === 'Error' && tag.value === 'Reassign-Name-Error',
    );
    assert(error, 'Reassign-Name-Error message not found');
  });

  it('should send a reassign-name-error-notice for invalid process IDs', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Reassign-Name' },
        { name: 'IO-Process-Id', value: 'io-process-id' },
        { name: 'Name', value: 'name' },
        { name: 'Process-Id', value: 'Whpisudfys089yfs0df' },
      ],
    });

    // assert no other messages
    assert(result.Messages?.length === 1, 'Expected only one message');

    const error = result.Messages[0]?.Tags.find(
      (tag) => tag.name === 'Error' && tag.value === 'Reassign-Name-Error',
    );
    assert(error, 'Reassign-Name-Error message not found');
  });
});
