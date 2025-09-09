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
        { name: 'Record-Owner', value: recordOwner },
        { name: 'Display-Name', value: 'Test Subdomain' },
        { name: 'Description', value: 'A test subdomain with ownership' },
      ],
    });

    console.dir(setRecordResult, { depth: null });

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
        { name: 'Record-Owner', value: recordOwner },
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
          { name: 'Display-Name', value: 'Updated by Owner' },
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
        { name: 'Record-Owner', value: recordOwner },
      ],
    });

    assertPatchMessage(createResult);

    // Transfer ownership
    const transferResult = await handle(
      {
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Transfer-Record' },
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

  describe('Transfer Ownership Edge Cases', () => {
    it('should prevent transferring record that does not exist', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
      const recipient = 'recipient-addr-'.padEnd(43, '3');

      const transferNonExistentResult = await handle({
        From: recordOwner,
        Owner: recordOwner,
        Tags: [
          { name: 'Action', value: 'Transfer-Record' },
          { name: 'Sub-Domain', value: 'nonexistent' },
          { name: 'Recipient', value: recipient },
        ],
      });

      assert(
        transferNonExistentResult.Messages[0].Tags.find(
          (t) => t.name === 'Error',
        ),
        'Should error when record does not exist',
      );
      assert(
        transferNonExistentResult.Messages[0].Data.includes(
          'Record does not exist',
        ),
        'Error should mention record not existing',
      );
    });

    it('should prevent transferring record with no owner', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
      const recipient = 'recipient-addr-'.padEnd(43, '3');

      // Create record without owner
      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'noowner' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          // No Owner tag
        ],
      });

      assertPatchMessage(createResult);

      const transferNoOwnerResult = await handle(
        {
          From: recordOwner,
          Owner: recordOwner,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'noowner' },
            { name: 'Recipient', value: recipient },
          ],
        },
        createResult.Memory,
      );

      assert(
        transferNoOwnerResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error when record has no owner',
      );
      assert(
        transferNoOwnerResult.Messages[0].Data.includes('Record has no owner'),
        'Error should mention record has no owner',
      );
    });

    it('should prevent transferring to invalid recipient address', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');

      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'invalidrecipient' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
        ],
      });

      assertPatchMessage(createResult);

      const transferInvalidResult = await handle(
        {
          From: recordOwner,
          Owner: recordOwner,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'invalidrecipient' },
            { name: 'Recipient', value: 'invalid-address' }, // Too short
          ],
        },
        createResult.Memory,
      );

      assert(
        transferInvalidResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on invalid recipient address',
      );
      assert(
        transferInvalidResult.Messages[0].Data.includes(
          'Invalid new owner address',
        ),
        'Error should mention invalid address',
      );
    });

    it('should prevent transferring to the same owner', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');

      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'sameowner' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
        ],
      });

      assertPatchMessage(createResult);

      const transferSameResult = await handle(
        {
          From: recordOwner,
          Owner: recordOwner,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'sameowner' },
            { name: 'Recipient', value: recordOwner }, // Same as current owner
          ],
        },
        createResult.Memory,
      );

      assert(
        transferSameResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error when transferring to same owner',
      );
      assert(
        transferSameResult.Messages[0].Data.includes(
          'New owner same as current owner',
        ),
        'Error should mention same owner',
      );
    });

    it('should prevent non-owners from transferring ownership', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
      const recipient = 'recipient-addr-'.padEnd(43, '3');
      const randomUser = 'random-user-addr-'.padEnd(43, '4');

      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'unauthorized' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
        ],
      });

      assertPatchMessage(createResult);

      const unauthorizedTransferResult = await handle(
        {
          From: randomUser,
          Owner: randomUser,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'unauthorized' },
            { name: 'Recipient', value: recipient },
          ],
        },
        createResult.Memory,
      );

      assert(
        unauthorizedTransferResult.Messages[0].Tags.find(
          (t) => t.name === 'Error',
        ),
        'Should error when non-owner attempts transfer',
      );
      assert(
        unauthorizedTransferResult.Messages[0].Data.includes('permission'),
        'Error should mention permissions',
      );
    });

    it('should allow ANT owner to transfer any record ownership', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
      const recipient = 'recipient-addr-'.padEnd(43, '3');

      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'antowntransfer' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
        ],
      });

      assertPatchMessage(createResult);

      // ANT owner (STUB_ADDRESS) transfers someone else's record
      const antOwnerTransferResult = await handle(
        {
          From: STUB_ADDRESS,
          Owner: STUB_ADDRESS,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'antowntransfer' },
            { name: 'Recipient', value: recipient },
          ],
        },
        createResult.Memory,
      );

      assertPatchMessage(antOwnerTransferResult);

      const transferData = JSON.parse(antOwnerTransferResult.Messages[0].Data);
      assert.equal(transferData.previousOwner, recordOwner);
      assert.equal(transferData.recipient, recipient);

      // Verify ownership notice was sent
      const notice = antOwnerTransferResult.Messages.find(
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

    it('should verify ownership actually changes after transfer', async () => {
      const recordOwner = 'record-owner-addr-'.padEnd(43, '2');
      const recipient = 'recipient-addr-'.padEnd(43, '3');

      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'verify' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
        ],
      });

      assertPatchMessage(createResult);

      const transferResult = await handle(
        {
          From: recordOwner,
          Owner: recordOwner,
          Tags: [
            { name: 'Action', value: 'Transfer-Record' },
            { name: 'Sub-Domain', value: 'verify' },
            { name: 'Recipient', value: recipient },
          ],
        },
        createResult.Memory,
      );

      assertPatchMessage(transferResult);

      // Verify the record now has the new owner
      const recordResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'verify' },
          ],
        },
        transferResult.Memory,
      );

      const record = JSON.parse(recordResult.Messages[0].Data);
      assert.equal(record.owner, recipient, 'Record should have new owner');

      // Verify the new owner can now update the record
      const newOwnerUpdateResult = await handle(
        {
          From: recipient,
          Owner: recipient,
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'verify' },
            {
              name: 'Transaction-Id',
              value: 'new-owner-update-'.padEnd(43, '5'),
            },
            { name: 'TTL-Seconds', value: '1800' },
            { name: 'Display-Name', value: 'Updated by New Owner' },
          ],
        },
        transferResult.Memory,
      );

      assertPatchMessage(newOwnerUpdateResult);

      const updatedRecord = JSON.parse(newOwnerUpdateResult.Messages[0].Data);
      assert.equal(updatedRecord.displayName, 'Updated by New Owner');
      assert.equal(updatedRecord.owner, recipient);
    });
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
        { name: 'Record-Owner', value: recordOwner },
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
        { name: 'Record-Owner', value: recordOwner },
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
          { name: 'Display-Name', value: 'myname_testant' },
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
        { name: 'Record-Owner', value: recordOwner },
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
          { name: 'Display-Name', value: 'secured_testant' },
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

  describe('Metadata Validation', () => {
    it('should validate displayName field', async () => {
      // Test valid displayName
      const validNameResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'validname' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Display-Name', value: 'Valid Display Name' },
        ],
      });

      assertPatchMessage(validNameResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'validname' },
          ],
        },
        validNameResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(recordData.displayName, 'Valid Display Name');

      // Test name too long (>61 chars)
      const nameTooLongResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'metadata1' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Display-Name', value: 'A'.repeat(62) }, // Too long
        ],
      });

      assert(
        nameTooLongResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on name too long',
      );

      // Test name at exact limit (61 chars)
      const nameAtLimitResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'exactlimit' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Display-Name', value: 'A'.repeat(61) }, // Exactly at limit
        ],
      });

      assertPatchMessage(nameAtLimitResult);
    });

    it('should validate description field', async () => {
      // Test valid description
      const validDescResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'validdesc' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          {
            name: 'Description',
            value: 'This is a valid description for the record',
          },
        ],
      });

      assertPatchMessage(validDescResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'validdesc' },
          ],
        },
        validDescResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(
        recordData.description,
        'This is a valid description for the record',
      );

      // Test description too long (>512 chars)
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

      // Test description at exact limit (512 chars)
      const descAtLimitResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'desclimit' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Description', value: 'C'.repeat(512) }, // Exactly at limit
        ],
      });

      assertPatchMessage(descAtLimitResult);
    });

    it('should validate logo field', async () => {
      // Test valid logo (Arweave transaction ID)
      const validLogoResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'validlogo' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Logo', value: 'valid-logo-id-'.padEnd(43, '1') },
        ],
      });

      assertPatchMessage(validLogoResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'validlogo' },
          ],
        },
        validLogoResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(recordData.logo, 'valid-logo-id-'.padEnd(43, '1'));

      // Test invalid logo format
      const invalidLogoResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'invalidlogo' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Logo', value: 'invalid-logo' }, // Too short
        ],
      });

      assert(
        invalidLogoResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on invalid logo format',
      );
    });

    it('should validate keywords field', async () => {
      // Test valid keywords
      const validKeywords = JSON.stringify([
        'web3',
        'arweave',
        'decentralized',
      ]);
      const validKeywordsResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'validkeywords' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: validKeywords },
        ],
      });

      assertPatchMessage(validKeywordsResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'validkeywords' },
          ],
        },
        validKeywordsResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.deepEqual(recordData.keywords, [
        'web3',
        'arweave',
        'decentralized',
      ]);

      // Test too many keywords (>16)
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

      // Test keyword too long (>32 chars)
      const longKeyword = JSON.stringify(['A'.repeat(33)]);
      const longKeywordResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'longkeyword' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: longKeyword },
        ],
      });

      assert(
        longKeywordResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on keyword too long',
      );

      // Test invalid keyword format (non-string)
      const invalidKeyword = JSON.stringify([123, 'valid']);
      const invalidKeywordResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'invalidkeyword' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: invalidKeyword },
        ],
      });

      assert(
        invalidKeywordResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on non-string keyword',
      );

      // Test invalid JSON format
      const invalidJsonResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'invalidjson' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: 'not-valid-json' },
        ],
      });

      assert(
        invalidJsonResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Should error on invalid JSON format',
      );

      // Test empty keywords array
      const emptyKeywords = JSON.stringify([]);
      const emptyKeywordsResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'emptykeywords' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: emptyKeywords },
        ],
      });

      assertPatchMessage(emptyKeywordsResult);

      // Test exact limit (16 keywords)
      const maxKeywords = JSON.stringify(
        Array(16)
          .fill('keyword')
          .map((k, i) => k + i),
      );
      const maxKeywordsResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'maxkeywords' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Keywords', value: maxKeywords },
        ],
      });

      assertPatchMessage(maxKeywordsResult);
    });

    it('should support setting multiple metadata fields together', async () => {
      const recordOwner = 'multi-field-owner-'.padEnd(43, '3');
      const keywords = JSON.stringify(['web3', 'decentralized', 'blockchain']);

      const multiFieldResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'multifield' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
          { name: 'Display-Name', value: 'Multi Field Record' },
          {
            name: 'Description',
            value: 'A record with multiple metadata fields',
          },
          { name: 'Logo', value: 'logo-transaction-'.padEnd(43, '2') },
          { name: 'Keywords', value: keywords },
        ],
      });

      assertPatchMessage(multiFieldResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'multifield' },
          ],
        },
        multiFieldResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(recordData.owner, recordOwner);
      assert.equal(recordData.displayName, 'Multi Field Record');
      assert.equal(
        recordData.description,
        'A record with multiple metadata fields',
      );
      assert.equal(recordData.logo, 'logo-transaction-'.padEnd(43, '2'));
      assert.deepEqual(recordData.keywords, [
        'web3',
        'decentralized',
        'blockchain',
      ]);
    });

    it('should preserve metadata fields during partial updates', async () => {
      const recordOwner = 'preserve-owner-'.padEnd(43, '4');
      const originalKeywords = JSON.stringify(['original', 'keywords']);

      // Create record with all metadata
      const createResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'preserve' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Record-Owner', value: recordOwner },
          { name: 'Display-Name', value: 'Original Name' },
          { name: 'Description', value: 'Original description' },
          { name: 'Logo', value: 'original-logo-'.padEnd(43, '3') },
          { name: 'Keywords', value: originalKeywords },
        ],
      });

      assertPatchMessage(createResult);

      // Update only displayName and TTL, should preserve other fields
      const updateResult = await handle(
        {
          From: recordOwner,
          Owner: recordOwner,
          Tags: [
            { name: 'Action', value: 'Set-Record' },
            { name: 'Sub-Domain', value: 'preserve' },
            { name: 'Transaction-Id', value: 'updated-tx-id-'.padEnd(43, '4') },
            { name: 'TTL-Seconds', value: '1800' },
            { name: 'Display-Name', value: 'Updated Name' },
          ],
        },
        createResult.Memory,
      );

      assertPatchMessage(updateResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'preserve' },
          ],
        },
        updateResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      // Updated fields
      assert.equal(recordData.transactionId, 'updated-tx-id-'.padEnd(43, '4'));
      assert.equal(recordData.ttlSeconds, 1800);
      assert.equal(recordData.displayName, 'Updated Name');
      // Preserved fields
      assert.equal(recordData.owner, recordOwner);
      assert.equal(recordData.description, 'Original description');
      assert.equal(recordData.logo, 'original-logo-'.padEnd(43, '3'));
      assert.deepEqual(recordData.keywords, ['original', 'keywords']);
    });

    it('should handle special characters and unicode in metadata', async () => {
      const unicodeResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'unicode' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Display-Name', value: 'Unicode Test 🌟 ñáéíóú' },
          {
            name: 'Description',
            value: 'Description with émojis 🎉 and spëcial chars: !@#$%^&*()',
          },
        ],
      });

      assertPatchMessage(unicodeResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'unicode' },
          ],
        },
        unicodeResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(recordData.displayName, 'Unicode Test 🌟 ñáéíóú');
      assert.equal(
        recordData.description,
        'Description with émojis 🎉 and spëcial chars: !@#$%^&*()',
      );
    });

    it('should handle empty string metadata fields', async () => {
      const emptyStringsResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'emptystrings' },
          { name: 'Transaction-Id', value: STUB_ADDRESS },
          { name: 'TTL-Seconds', value: '900' },
          { name: 'Display-Name', value: '' },
          { name: 'Description', value: '' },
        ],
      });

      assertPatchMessage(emptyStringsResult);

      const record = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Record' },
            { name: 'Sub-Domain', value: 'emptystrings' },
          ],
        },
        emptyStringsResult.Memory,
      );

      const recordData = JSON.parse(record.Messages[0].Data);
      assert.equal(recordData.displayName, '');
      assert.equal(recordData.description, '');
    });
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
          { name: 'Record-Owner', value: recordOwner },
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
