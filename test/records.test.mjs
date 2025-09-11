import { assertPatchMessage, createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('aos Records', async () => {
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
  async function getInfo(mem) {
    const result = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      mem,
    );

    return JSON.parse(result.Messages[0].Data);
  }

  async function setRecord(
    { name, ttl = 900, transactionId = STUB_ADDRESS, priority = undefined },
    mem,
  ) {
    return handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: name },
          { name: 'TTL-Seconds', value: ttl },
          { name: 'Transaction-Id', value: transactionId },
          { name: 'Priority', value: priority },
        ].filter((t) => t.value !== undefined),
      },
      mem,
    );
  }

  async function removeRecord(name, mem) {
    return handle(
      {
        Tags: [
          { name: 'Action', value: 'Remove-Record' },
          { name: 'Sub-Domain', value: name },
        ],
      },
      mem,
    );
  }

  async function getRecords(mem) {
    const res = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      mem,
    );

    return JSON.parse(res.Messages[0].Data);
  }

  async function getRecord(name, mem) {
    const res = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Record' },
          { name: 'Sub-Domain', value: name },
        ],
      },
      mem,
    );

    // Check if it's an error message
    const message = res.Messages[0];
    if (message.Tags.find((tag) => tag.name === 'Error')) {
      throw new Error(`Failed to get record: ${message.Data}`);
    }

    return JSON.parse(message.Data);
  }

  it('should get the records of the ant', async () => {
    const setRecordRes = await setRecord({ name: 'test-1' });

    const records = await getRecords(setRecordRes);
    assert(records);
  });

  it('should get a singular record of the ant', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Record' },
        { name: 'Sub-Domain', value: '@' },
      ],
    });

    const record = JSON.parse(result.Messages[0].Data);
    assert(record);
    assert(record.transactionId);
    assert(record.ttlSeconds);
  });

  it('should set the record of an ANT', async () => {
    // Get initial state of @ record
    const initialRecordsResult = await handle({
      Tags: [{ name: 'Action', value: 'Records' }],
    });
    const initialRecords = JSON.parse(initialRecordsResult.Messages[0].Data);
    const initialRecord = initialRecords['@'];

    const setRecordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: '@' },
          { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
          { name: 'TTL-Seconds', value: 900 },
        ],
      },
      initialRecordsResult.Memory,
    );

    assertPatchMessage(setRecordResult);

    // Verify the record was updated correctly
    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );

    const records = JSON.parse(recordsResult.Messages[0].Data);
    const record = records['@'];

    // Verify the changes
    assert.strictEqual(
      record.transactionId,
      ''.padEnd(43, '3'),
      'Transaction ID should be updated',
    );
    assert.strictEqual(record.ttlSeconds, 900, 'TTL should be updated');
    assert.strictEqual(record.priority, 0, '@ record priority should remain 0');

    // Verify other fields remain unchanged if they existed
    if (initialRecord.owner !== undefined) {
      assert.strictEqual(
        record.owner,
        initialRecord.owner,
        'Owner should remain unchanged',
      );
    }
  });

  it('should remove the record of an ANT', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'timmy' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 900 },
      ],
    });

    assertPatchMessage(setRecordResult);

    const removeRecordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Remove-Record' },
          { name: 'Sub-Domain', value: 'timmy' },
        ],
      },
      setRecordResult.Memory,
    );

    assertPatchMessage(removeRecordResult);

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      removeRecordResult.Memory,
    );

    const record = JSON.parse(recordsResult.Messages[0].Data)['timmy'];
    assert(!record);
  });

  it('should set name as lower case when provided as uppercase', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'Timmy' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 900 },
      ],
    });

    assertPatchMessage(setRecordResult);

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );

    const records = JSON.parse(recordsResult.Messages[0].Data);
    const record = records['timmy'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 900);
  });

  it('should set name with priority order', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'Timmy' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 900 },
        { name: 'Priority', value: 1 },
      ],
    });

    assertPatchMessage(setRecordResult);

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );

    const records = JSON.parse(recordsResult.Messages[0].Data);
    const record = records['timmy'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 900);
    assert(record.priority === 1);
  });

  it('should fail when trying to set non-zero priority for @ record', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: '@' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 900 },
        { name: 'Priority', value: 1 },
      ],
    });

    assert.equal(
      setRecordResult.Messages.length,
      2,
      'Expected patch and error message',
    );
    assertPatchMessage(setRecordResult);

    const errorMessage = setRecordResult.Messages[0];
    assert.strictEqual(
      errorMessage.Tags.find((tag) => tag.name === 'Error').value,
      'Set-Record-Error',
      'Expected error tag in response',
    );

    assert(
      errorMessage.Data.includes('Cannot assign non-zero priority to @ record'),
      `Error message should mention @ record priority restriction. Actual: ${errorMessage.Data}`,
    );
  });

  it('should allow @ record with priority 0 or nil', async () => {
    // Test with explicit priority 0
    const setRecordResult1 = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: '@' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '4') },
        { name: 'TTL-Seconds', value: 900 },
        { name: 'Priority', value: 0 },
      ],
    });

    assertPatchMessage(setRecordResult1);

    // Test with no priority (nil)
    const setRecordResult2 = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: '@' },
          { name: 'Transaction-Id', value: ''.padEnd(43, '5') },
          { name: 'TTL-Seconds', value: 1800 },
          // No Priority tag
        ],
      },
      setRecordResult1.Memory,
    );

    assertPatchMessage(setRecordResult2);

    // Verify the record was created correctly
    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult2.Memory,
    );
    const records = JSON.parse(recordsResult.Messages[0].Data);
    const record = records['@'];

    assert.strictEqual(record.priority, 0, '@ record priority should be 0');
    assert.strictEqual(
      record.ttlSeconds,
      1800,
      '@ record should have updated TTL',
    );
  });

  it('should fail when setting priority for @ record', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'timmy' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 900 },
        { name: 'Priority', value: '1.089' },
      ],
    });

    assertPatchMessage(setRecordResult);

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );
    const records = JSON.parse(recordsResult.Messages[0].Data);

    assert(!records['timmy']);
    assertPatchMessage(recordsResult);
  });

  it('should fail when Sub-Domain is missing', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        // Missing Sub-Domain tag
        { name: 'TTL-Seconds', value: '900' },
        { name: 'Transaction-Id', value: STUB_ADDRESS },
      ],
    });

    assert.equal(
      setRecordResult.Messages.length,
      2,
      'Expected patch and error message',
    );
    assertPatchMessage(setRecordResult);

    const errorMessage = setRecordResult.Messages[0];
    assert.strictEqual(
      errorMessage.Tags.find((tag) => tag.name === 'Error').value,
      'Set-Record-Error',
      'Expected error tag in response',
    );

    assert(
      errorMessage.Data.includes('Sub-Domain is required'),
      `Error message should indicate Sub-Domain is missing. Actual: ${errorMessage.Data}`,
    );

    // Verify that no record was created by checking the records state
    const recordsAfterError = await getRecords(setRecordResult.Memory);

    // Should not have any records with undefined/null names
    const recordNames = Object.keys(recordsAfterError);
    assert(
      !recordNames.some(
        (name) => name === 'undefined' || name === 'null' || name === '',
      ),
      'No invalid records should be created when Sub-Domain is missing',
    );
  });

  describe('Authorization Tests', () => {
    const UNAUTHORIZED_ADDRESS = 'unauthorized-address-'.padEnd(43, '9');

    it('should fail to set record when called by non-owner/non-controller', async () => {
      const infoBefore = await getInfo(startMemory);
      assert.notEqual(
        UNAUTHORIZED_ADDRESS,
        infoBefore.Owner,
        'Non-owner parameter should not be the current owner',
      );

      // Get initial records state before unauthorized attempt
      const recordsBeforeAttempt = await getRecords(startMemory);
      assert(
        !recordsBeforeAttempt['unauthorized-test'],
        'Record should not exist initially',
      );

      const setRecordResult = await handle({
        From: UNAUTHORIZED_ADDRESS,
        Owner: UNAUTHORIZED_ADDRESS,
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'unauthorized-test' },
          { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
          { name: 'TTL-Seconds', value: 900 },
        ],
      });

      assert.equal(
        setRecordResult.Messages.length,
        2,
        'Expected patch and error message',
      );
      const errorMessage = setRecordResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Record-Error',
        'Expected error tag in response',
      );
      assertPatchMessage(setRecordResult);

      // Verify the record was not actually set and state remains unchanged
      const recordsAfterFailedAttempt = await getRecords(
        setRecordResult.Memory,
      );
      assert(
        !recordsAfterFailedAttempt['unauthorized-test'],
        'Record should not be set by unauthorized user',
      );

      // Verify existing records remain unchanged
      const existingRecordNames = Object.keys(recordsBeforeAttempt);
      existingRecordNames.forEach((recordName) => {
        assert.deepStrictEqual(
          recordsAfterFailedAttempt[recordName],
          recordsBeforeAttempt[recordName],
          `Existing record '${recordName}' should remain unchanged`,
        );
      });
    });

    it('should fail to remove record when called by non-owner/non-controller', async () => {
      // First, set a record as the authorized owner
      const infoBefore = await getInfo(startMemory);
      assert.notEqual(
        UNAUTHORIZED_ADDRESS,
        infoBefore.Owner,
        'Non-owner parameter should not be the current owner',
      );
      const setRecordResult = await handle({
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: 'to-be-removed' },
          { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
          { name: 'TTL-Seconds', value: 900 },
        ],
      });
      assertPatchMessage(setRecordResult);

      // Verify the record was set
      const recordsAfterSet = await handle(
        {
          Tags: [{ name: 'Action', value: 'Records' }],
        },
        setRecordResult.Memory,
      );
      const recordsSet = JSON.parse(recordsAfterSet.Messages[0].Data);
      assert(
        recordsSet['to-be-removed'],
        'Record should be set before removal test',
      );

      // Try to remove the record as an unauthorized user
      const removeRecordResult = await handle(
        {
          From: UNAUTHORIZED_ADDRESS,
          Owner: UNAUTHORIZED_ADDRESS,
          Tags: [
            { name: 'Action', value: 'Remove-Record' },
            { name: 'Sub-Domain', value: 'to-be-removed' },
          ],
        },
        setRecordResult.Memory,
      );

      assert.equal(
        removeRecordResult.Messages.length,
        2,
        'Expected patch and error message',
      );
      assertPatchMessage(removeRecordResult);

      const errorMessage = removeRecordResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Remove-Record-Error',
        'Expected error tag in response',
      );

      // Verify the record was not actually removed
      const recordsAfterRemove = await handle(
        {
          Tags: [{ name: 'Action', value: 'Records' }],
        },
        removeRecordResult.Memory,
      );
      const recordsRemaining = JSON.parse(recordsAfterRemove.Messages[0].Data);
      assert(
        recordsRemaining['to-be-removed'],
        'Record should still exist after unauthorized removal attempt',
      );
    });
  });
});
