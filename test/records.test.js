const { createAntAosLoader } = require('./utils');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} = require('../tools/constants');

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

  it('Should get the records of the ant', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Records' }],
    });

    const records = JSON.parse(result.Messages[0].Data);
    assert(records);
    assert(records['@']);
  });

  it('Should get a singular record of the ant', async () => {
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

  it('Should set the record of an ANT', async () => {
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

    const record = JSON.parse(recordsResult.Messages[0].Data)['@'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 3600);
  });

  it('Should remove the record of an ANT', async () => {
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

    const record = JSON.parse(recordsResult.Messages[0].Data)['timmy'];
    assert(record.transactionId === ''.padEnd(43, '3'));
    assert(record.ttlSeconds === 3600);
  });
});
