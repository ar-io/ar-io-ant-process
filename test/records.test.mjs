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
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: '@' },
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
    const record = records['@'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 900);
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

  it('should force priority to 0 for @ record', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: '@' },
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

    const record = records['@'];
    assert(record.priority === 0);
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

  describe('Authorization Tests', () => {
    const UNAUTHORIZED_ADDRESS = 'unauthorized-address-'.padEnd(43, '9');

    it('should fail to set record when called by non-owner/non-controller', async () => {
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

      // Should return an error message, not a patch message
      assert(setRecordResult.Messages?.length > 0, 'Expected error message');
      const errorMessage = setRecordResult.Messages[0];
      assert.strictEqual(
        errorMessage.Tags.find((tag) => tag.name === 'Error').value,
        'Set-Record-Error',
        'Expected error tag in response',
      );

      // Verify the record was not actually set
      const recordsResult = await handle(
        {
          Tags: [{ name: 'Action', value: 'Records' }],
        },
        setRecordResult.Memory,
      );
      const records = JSON.parse(recordsResult.Messages[0].Data);
      assert(
        !records['unauthorized-test'],
        'Record should not be set by unauthorized user',
      );
    });

    it('should fail to remove record when called by non-owner/non-controller', async () => {
      // First, set a record as the authorized owner
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

      // Should return an error message, not a patch message
      assert(removeRecordResult.Messages?.length > 0, 'Expected error message');
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
