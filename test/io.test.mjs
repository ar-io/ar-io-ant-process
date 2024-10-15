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

    const message = result.Messages[0]?.Tags?.find(
      (tag) => tag.name === 'Action' && tag.value === 'Release-Name-Notice',
    );
    assert(message, 'Release-Name-Notice message not found');

    // ensure a message Target is the IO process id provided and the other is to the sender and both contain the initiator, name and process id
    assert(
      result.Messages.some(
        (msg) =>
          msg.Target === 'io-process-id-'.padEnd(43, '1') &&
          msg.Tags.find(
            (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
          ) &&
          msg.Tags.find((tag) => tag.name === 'Name' && tag.value === 'name') &&
          msg.Tags.find(
            (tag) =>
              tag.name === 'Action' && tag.value === 'Release-Name-Notice',
          ),
      ),
    );

    assert(
      result.Messages.some(
        (msg) =>
          msg.Target === STUB_ADDRESS &&
          msg.Tags.find(
            (tag) => tag.name === 'Initiator' && tag.value === STUB_ADDRESS,
          ) &&
          msg.Tags.find((tag) => tag.name === 'Name' && tag.value === 'name') &&
          msg.Tags.find(
            (tag) =>
              tag.name === 'Action' && tag.value === 'Release-Name-Notice',
          ),
      ),
    );
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
});
