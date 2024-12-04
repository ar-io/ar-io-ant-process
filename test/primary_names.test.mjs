import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  STUB_ETH_ADDRESS,
} from '../tools/constants.mjs';

describe('Primary Names', async () => {
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
  const STUB_RECIPIENT = 'recipient-'.padEnd(43, '1');

  for (const [target_address, allowUnsafe, shouldPass] of [
    [STUB_RECIPIENT, undefined, true],
    [STUB_RECIPIENT, true, true],
    [STUB_RECIPIENT, false, true],
    [STUB_ETH_ADDRESS, undefined, true],
    [STUB_ETH_ADDRESS, true, true],
    [STUB_ETH_ADDRESS, false, true],
    ['invalid-address', true, true],
    ['invalid-address', false, false],
    ['invalid-address', false, false],
  ]) {
    it('should send approval for name request', async () => {
      const ioProcessId = ''.padEnd(43, '1');
      const res = await handle({
        Tags: [
          {
            name: 'Action',
            value: 'Approve-Primary-Name',
          },
          { name: 'IO-Process-Id', value: ioProcessId },
          { name: 'Recipient', value: target_address },
          { name: 'Name', value: ''.padEnd(43, '3') },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      if (shouldPass === true) {
        const approveNameRequest = res.Messages[0];
        const actionTag = approveNameRequest.Tags.find(
          (t) => t.name == 'Action',
        );
        const recipientTag = approveNameRequest.Tags.find(
          (t) => t.name == 'Recipient',
        );
        const nameTag = approveNameRequest.Tags.find((t) => t.name == 'Name');

        assert.strictEqual(approveNameRequest.Target, ioProcessId);
        assert.strictEqual(actionTag.value, 'Approve-Primary-Name-Request');
        assert.strictEqual(recipientTag.value, target_address);
        assert.strictEqual(nameTag.value, ''.padEnd(43, '3'));
      } else {
        assert.strictEqual(
          res.Messages[0].Tags.find((t) => t.name === 'Error')?.value,
          'Approve-Primary-Name-Error',
        );
      }
    });
  }

  it('should not approve request if caller not owner', async () => {
    const res = await handle({
      Owner: 'not-owner'.padEnd(43, '1'),
      From: 'not-owner'.padEnd(43, '1'),
      Tags: [
        {
          name: 'Action',
          value: 'Approve-Primary-Name',
        },
        { name: 'IO-Process-Id', value: ''.padEnd(43, '1') },
        { name: 'Recipient', value: ''.padEnd(43, '2') },
        { name: 'Name', value: ''.padEnd(43, '3') },
      ],
    });
    const invalidMessage = res.Messages[0];
    const actionTag = invalidMessage.Tags.find((t) => t.name == 'Action');
    assert.strictEqual(actionTag.value, 'Invalid-Approve-Primary-Name-Notice');
  });

  it('should send remove names request', async () => {
    const names = ['foo', 'bar', 'baz'];
    const res = await handle({
      Tags: [
        { name: 'Action', value: 'Remove-Primary-Names' },
        { name: 'Names', value: names.join(',') },
        { name: 'IO-Process-Id', value: ''.padEnd(43, '2') },
      ],
    });

    const removePrimaryNamesMsg = res.Messages[0];
    const actionTag = removePrimaryNamesMsg.Tags.find(
      (t) => t.name == 'Action',
    );
    const namesTag = removePrimaryNamesMsg.Tags.find((t) => t.name == 'Names');

    assert.strictEqual(removePrimaryNamesMsg.Target, ''.padEnd(43, '2'));
    assert.strictEqual(actionTag.value, 'Remove-Primary-Names');
    assert.strictEqual(namesTag.value, names.join(','));
  });
  it('should not send remove names request if caller not owner', async () => {
    const names = ['foo', 'bar', 'baz'];
    const res = await handle({
      Owner: 'not-owner'.padEnd(43, '1'),
      From: 'not-owner'.padEnd(43, '1'),
      Tags: [
        { name: 'Action', value: 'Remove-Primary-Names' },
        { name: 'Names', value: names.join(',') },
        { name: 'IO-Process-Id', value: ''.padEnd(43, '2') },
      ],
    });

    const invalidMessage = res.Messages[0];
    const actionTag = invalidMessage.Tags.find((t) => t.name == 'Action');
    assert.strictEqual(actionTag.value, 'Invalid-Remove-Primary-Names-Notice');
  });
});
