import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  STUB_ETH_ADDRESS,
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

  async function getTotalSupply(mem) {
    const result = await handle(
      {
        From: 'random-dude'.padEnd(43, '1'),
        Owner: 'random-dude'.padEnd(43, '1'),
        Tags: [{ name: 'Action', value: 'Total-Supply' }],
      },
      mem,
    );

    return result.Messages[0].Data;
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
    it(`should ${shouldPass ? '' : 'not'} fetch the target balance`, async () => {
      const result = await handle({
        Tags: [
          { name: 'Action', value: 'Balance' },
          { name: 'Recipient', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      if (shouldPass === true) {
        const targetBalance = result.Messages[0].Data;
        assert.equal(typeof targetBalance === 'number', shouldPass);
      } else {
        assert.strictEqual(
          result.Messages[0].Tags.find((t) => t.name === 'Error')?.value,
          'Balance-Error',
        );
      }
    });

    it(`should ${allowUnsafe ? '' : 'not'} transfer the ANT`, async () => {
      const transferResult = await handle({
        Tags: [
          { name: 'Action', value: 'Transfer' },
          { name: 'Recipient', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      if (shouldPass === true) {
        const balancesResult = await handle(
          {
            Tags: [{ name: 'Action', value: 'Balances' }],
          },
          transferResult.Memory,
        );
        const balances = JSON.parse(balancesResult.Messages[0].Data);
        assert.equal(balances[target_address] === 1, shouldPass);
      } else {
        assert.strictEqual(
          transferResult.Messages[0].Tags.find((t) => t.name === 'Error')
            ?.value,
          'Transfer-Error',
        );
      }
    });

    it(`should ${shouldPass ? '' : 'not'} send credit and debit notice on transfer`, async () => {
      const transferResult = await handle({
        Tags: [
          { name: 'Action', value: 'Transfer' },
          { name: 'Recipient', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      if (shouldPass === true) {
        const creditNotice = transferResult.Messages.find((msg) =>
          msg.Tags.find(
            (tag) => tag.name === 'Action' && tag.value === 'Credit-Notice',
          ),
        );
        const sender = creditNotice.Tags.find(
          (tag) => tag.name === 'Sender' && tag.value === STUB_ADDRESS,
        ).value;
        assert.equal(sender === STUB_ADDRESS, shouldPass);
        const debitNotice = transferResult.Messages.find((msg) =>
          msg.Tags.find(
            (tag) => tag.name === 'Action' && tag.value === 'Debit-Notice',
          ),
        );
        const recipient = debitNotice.Tags.find(
          (tag) => tag.name === 'Recipient' && tag.value === target_address,
        ).value;
        assert.equal(recipient === target_address, shouldPass);
      } else {
        assert.strictEqual(
          transferResult.Messages[0].Tags.find((t) => t.name === 'Error')
            ?.value,
          'Transfer-Error',
        );
      }
    });
    // for end
  }

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

  it('should set the logo of the ant', async () => {
    const logo = 'my-logo-'.padEnd(43, '0');
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Set-Logo' },
        { name: 'Logo', value: logo },
      ],
    });

    const info = await getInfo(result.Memory);
    console.log('module memory: ', result.Memory.length);
    assert(info.Logo === logo, 'Failed to set logo');
  });
  it('should get total supply', async () => {
    const res = await getTotalSupply();
    assert.strictEqual(res, 1, 'total supply should be equal to 1');
  });
});
