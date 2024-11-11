import { createAntAosLoader } from './utils.mjs';
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
    { name, ttl = 3600, transactionId = STUB_ADDRESS },
    mem,
  ) {
    return handle(
      {
        Tags: [
          { name: 'Action', value: 'Set-Record' },
          { name: 'Sub-Domain', value: name },
          { name: 'TTL-Seconds', value: ttl },
          { name: 'Transaction-Id', value: transactionId },
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
    const setRecordRes2 = await setRecord(
      { name: 'test-2' },
      setRecordRes.Memory,
    );
    const setRecordRes3 = await setRecord(
      { name: 'test-3' },
      setRecordRes2.Memory,
    );

    const records = await getRecords(setRecordRes3.Memory);
    assert(records);
    const recordsMap = Object.fromEntries(records);
    assert(recordsMap['@']);
    // assert record order
    const undernames = Object.keys(recordsMap);
    assert(undernames[0] == '@');
    assert.strictEqual(undernames.at(-1), 'test-3');
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
        { name: 'TTL-Seconds', value: 3600 },
      ],
    });

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );

    const record = Object.fromEntries(
      JSON.parse(recordsResult.Messages[0].Data),
    )['@'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 3600);
  });

  it('should remove the record of an ANT', async () => {
    const setRecordResult = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Record' },
        { name: 'Sub-Domain', value: 'timmy' },
        { name: 'Transaction-Id', value: ''.padEnd(43, '3') },
        { name: 'TTL-Seconds', value: 3600 },
      ],
    });

    const removeRecordResult = await handle(
      {
        Tags: [
          { name: 'Action', value: 'Remove-Record' },
          { name: 'Sub-Domain', value: 'timmy' },
        ],
      },
      setRecordResult.Memory,
    );

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
        { name: 'TTL-Seconds', value: 3600 },
      ],
    });

    const recordsResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Records' }],
      },
      setRecordResult.Memory,
    );

    const record = Object.fromEntries(
      JSON.parse(recordsResult.Messages[0].Data),
    )['timmy'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 3600);
  });
});
