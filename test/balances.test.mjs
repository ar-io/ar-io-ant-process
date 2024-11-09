import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('aos Balances', async () => {
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

  it('should fetch the owner balance', async () => {
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Balance' },
        { name: 'Recipient', value: STUB_ADDRESS },
      ],
    });
    console.dir(result, { depth: null });
    const ownerBalance = result.Messages[0].Data;
    assert(ownerBalance === 1);
  });
  it('should fetch the balances of the ANT', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Balances' }],
    });

    const balances = JSON.parse(result.Messages[0].Data);
    assert(balances);
    const ownerEntry = Object.entries(balances)[0];
    const [ownerAddress, ownerBalance] = ownerEntry;
    assert(Object.entries(balances).length === 1);
    assert(ownerAddress === STUB_ADDRESS);
    assert(ownerBalance === 1);
  });

  it('should transfer the ANT', async () => {
    const recipient = ''.padEnd(43, '2');
    const transferResult = await handle({
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: recipient },
      ],
    });

    const balancesResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Balances' }],
      },
      transferResult.Memory,
    );

    const balances = JSON.parse(balancesResult.Messages[0].Data);
    assert(balances[recipient] === 1);
  });

  it('should send credit and debit notice on transfer', async () => {
    const recipient = ''.padEnd(43, '2');
    const transferResult = await handle({
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: recipient },
      ],
    });

    const creditNotice = transferResult.Messages.find((msg) =>
      msg.Tags.find(
        (tag) => tag.name === 'Action' && tag.value === 'Credit-Notice',
      ),
    );
    assert(creditNotice);
    assert(
      creditNotice.Tags.find(
        (tag) => tag.name === 'Sender' && tag.value === STUB_ADDRESS,
      ),
    );
    const debitNotice = transferResult.Messages.find((msg) =>
      msg.Tags.find(
        (tag) => tag.name === 'Action' && tag.value === 'Debit-Notice',
      ),
    );
    assert(debitNotice);
    assert(
      debitNotice.Tags.find(
        (tag) => tag.name === 'Recipient' && tag.value === recipient,
      ),
    );
  });

  it('should set the logo of the ant', async () => {
    const logo = 'my-logo-'.padEnd(43, '0');
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Logo' },
        { name: 'Logo', value: logo },
      ],
    });

    const info = await getInfo(result.Memory);
    assert(info.Logo === logo, 'Failed to set logo');
  });
});
