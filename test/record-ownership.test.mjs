import { assertPatchMessage, createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('Record Ownership', async () => {
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

  it('should allow ANT owner to assign record ownership', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');

    // Set a record with ownership
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'test' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
        { name: 'Name', value: 'Test Subdomain' },
        { name: 'Description', value: 'A test subdomain with ownership' },
      ],
    });

    assertPatchMessage(setRecordResult);

    // Verify record was created with ownership
    const recordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Record' },
          { name: 'Sub-Domain', value: 'test' },
        ],
      },
      setRecordResult.Memory,
    );

    const record = JSON.parse(recordResult.Messages[0].Data);
    assert.equal(record.owner, recordOwner);
    assert.equal(record.displayName, 'Test Subdomain');
    assert.equal(record.description, 'A test subdomain with ownership');
  });

  it('should allow record owner to update their record', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');

    // Create record with owner
    const createResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'owned' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Record owner updates their own record
    const updateResult = await handle(
      {
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'owned' },
          { name: 'Transaction-Id', value: 'updated-tx-id-'.padEnd(43, '2') },
          { name: 'TTL-Seconds', value: '1800' },
          { name: 'Name', value: 'Updated by Owner' },
        ],
      },
      createResult.Memory,
    );

    assertPatchMessage(updateResult);

    // Verify update succeeded
    const record = JSON.parse(updateResult.Messages[0].Data);
    assert.equal(record.transactionId, 'updated-tx-id-'.padEnd(43, '2'));
    assert.equal(record.ttlSeconds, 1800);
    assert.equal(record.displayName, 'Updated by Owner');
    assert.equal(record.owner, recordOwner); // Owner unchanged
  });

  it('should allow record owner to transfer ownership', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
    const recipient = 'Recipient-address-'.padEnd(43, '3');

    const createResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'transferable' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Transfer ownership
    const transferResult = await handle(
      {
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Transfer-Record-Ownership' },
          { name: 'Sub-Domain', value: 'transferable' },
          { name: 'Recipient', value: recipient },
        ],
      },
      createResult.Memory,
    );

    assertPatchMessage(transferResult);

    // Verify transfer
    const transferData = JSON.parse(transferResult.Messages[0].Data);
    assert.equal(transferData.previousOwner, recordOwner);
    assert.equal(transferData.recipient, recipient);

    // Verify ownership notice was sent
    const notice = transferResult.Messages.find(
      (m) =>
        m.Target === recipient &&
        m.Tags.find(
          (t) =>
            t.name === 'Action' &&
            t.value === 'Record-Ownership-Transfer-Notice',
        ),
    );
    assert(notice, 'Ownership transfer notice should be sent to new owner');
  });

  it('should prevent non-owners from updating owned records', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
    const randomUser = 'random-user-address-'.padEnd(43, '4');

    const createResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'protected' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Attempt update by non-owner
    const updateResult = await handle(
      {
        From: randomUser,
        Owner: randomUser,
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'protected' },
          { name: 'Transaction-Id', value: 'hacker-tx-id-'.padEnd(43, '3') },
          { name: 'TTL-Seconds', value: '100' },
        ],
      },
      createResult.Memory,
    );

    // Should have error message
    const errorMsg = updateResult.Messages[0];
    assert(
      errorMsg.Tags.find((t) => t.name === 'Error'),
      'Should return error',
    );
    assert(
      errorMsg.Data.includes('permission'),
      'Error should mention permissions',
    );
  });

  it('should allow record owner to set primary name for themselves only', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
    const ioProcessId = 'io-process-id-'.padEnd(43, '5');

    const createResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'myname' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Record owner approves primary name for themselves
    const approveResult = await handle(
      {
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Approve-Primary-Name' },
          { name: 'Name', value: 'myname_testant' },
          { name: 'Recipient', value: recordOwner },
          { name: 'IO-Process-Id', value: ioProcessId },
        ],
      },
      createResult.Memory,
    );

    // Should send approval to IO process
    const approvalMsg = approveResult.Messages.find(
      (m) =>
        m.Target === ioProcessId &&
        m.Tags.find(
          (t) =>
            t.name === 'Action' && t.value === 'Approve-Primary-Name-Request',
        ),
    );
    assert(approvalMsg, 'Should send approval to IO process');
    assert.equal(
      approvalMsg.Tags.find((t) => t.name === 'Name').value,
      'myname_testant',
    );
    assert.equal(
      approvalMsg.Tags.find((t) => t.name === 'Recipient').value,
      recordOwner,
    );
  });

  it('should prevent record owner from setting primary name for others', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
    const someoneElse = 'someone-else-addr-'.padEnd(43, '6');
    const ioProcessId = 'io-process-id-'.padEnd(43, '7');

    const createResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'secured' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Record owner tries to approve primary name for someone else
    const approveResult = await handle(
      {
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Approve-Primary-Name' },
          { name: 'Name', value: 'secured_testant' },
          { name: 'Recipient', value: someoneElse },
          { name: 'IO-Process-Id', value: ioProcessId },
        ],
      },
      createResult.Memory,
    );

    assertPatchMessage(approveResult);
    assert.equal(approveResult.Messages.length, 2);

    // Should have error
    const errorMsg = approveResult.Messages[0];
    assert(
      errorMsg.Tags.find((t) => t.name === 'Action'),
      'Invalid-Approve-Primary-Name-Notice',
    );
  });

  it('should validate metadata fields', async () => {
    // Test name too long
    const nameTooLongResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'metadata1' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Name', value: 'A'.repeat(62) }, // Too long
      ],
    });

    assert(
      nameTooLongResult.Messages[0].Tags.find((t) => t.name === 'Error'),
      'Should error on name too long',
    );

    // Test description too long
    const descTooLongResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'metadata2' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Description', value: 'B'.repeat(513) }, // Too long
      ],
    });

    assert(
      descTooLongResult.Messages[0].Tags.find((t) => t.name === 'Error'),
      'Should error on description too long',
    );

    // Test too many keywords
    const tooManyKeywords = JSON.stringify(Array(17).fill('keyword'));
    const keywordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'metadata3' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Keywords', value: tooManyKeywords },
      ],
    });

    assert(
      keywordResult.Messages[0].Tags.find((t) => t.name === 'Error'),
      'Should error on too many keywords',
    );
  });

  it('should maintain god mode for ANT owner', async () => {
    const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
    const controller = 'controller-addr-'.padEnd(43, '8');

    // Add controller
    const addControllerResult = await handle({
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: controller },
      ],
    });

    assertPatchMessage(addControllerResult);

    // Create owned record
    const createResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'owned' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Owner', value: recordOwner },
        ],
      },
      addControllerResult.Memory,
    );

    assertPatchMessage(createResult);

    // ANT owner can still modify owned record
    const ownerUpdateResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'owned' },
          {
            name: 'Transaction-Id',
            value: 'owner-updated-tx-'.padEnd(43, '4'),
          },
          { name: 'TTL-Seconds', value: '1800' },
        ],
      },
      createResult.Memory,
    );

    assertPatchMessage(ownerUpdateResult);

    assert.equal(
      JSON.parse(ownerUpdateResult.Messages[0].Data).transactionId,
      'owner-updated-tx-'.padEnd(43, '4'),
    );

    // Controller can also modify owned record
    const controllerUpdateResult = await handle(
      {
        From: controller,
        Owner: controller,
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'owned' },
          {
            name: 'Transaction-Id',
            value: 'controller-upd-tx-'.padEnd(43, '5'),
          },
          { name: 'TTL-Seconds', value: '3600' },
        ],
      },
      ownerUpdateResult.Memory,
    );

    assertPatchMessage(controllerUpdateResult);

    assert.equal(
      JSON.parse(controllerUpdateResult.Messages[0].Data).transactionId,
      'controller-upd-tx-'.padEnd(43, '5'),
    );
  });
});
