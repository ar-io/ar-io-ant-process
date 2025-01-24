import { createAntAosLoader } from '../utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../../tools/constants.mjs';

/**
 * Background
 *
 * This test is for testing the compliance with https://github.com/permaweb/aos/blob/main/blueprints/token.lua "spec"
 *
 * The reason we attempt to comply to this is for integration with other platforms like bazar.arweave.net and botega.arweave.net
 */

describe('Token spec compliance', async () => {
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

  /**
   * Handlers:
   * - info
   * - total supply
   * - balance
   * - balances
   * - transfer
   
   We do not implement:
   * - mint
   * - burn
   *
   */

  it('should get the process info', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Info' }],
    });
    /**
     * Check for:
     * - Name (string)
     * - Ticker (string)
     * - Logo (arweave ID)
     * - Denomination (number as string)
     */

    const tags = result.Messages[0].Tags;
    const ref = tags.find((t) => t.name === 'X-Reference')?.value;
    const name = tags.find((t) => t.name === 'Name')?.value;
    const ticker = tags.find((t) => t.name === 'Ticker')?.value;
    const logo = tags.find((t) => t.name === 'Logo')?.value;
    const denomination = tags.find((t) => t.name === 'Denomination')?.value;

    assert.strictEqual(typeof name, 'string');
    assert.strictEqual(typeof ticker, 'string');
    assert.strictEqual(typeof logo, 'string');
    assert.strictEqual(typeof denomination, 'string');
    assert.strictEqual(Number.isInteger(parseInt(denomination)), true);
    assert(ref, 'Not a reply message');
  });

  it('should get the balance of an account', async () => {
    /**
     * Test with caller as:
     * - Recipient
     * - Target
     * - From
     * Test as:
     * - Owner
     * - Anonymous
     *
     * Check for:
     * - Balance (string int)
     * - Ticker (string)
     * - Account (string equal to target address we are checking balance of)
     * - Data (same as balance, both in type and qty)
     */
    const targetAccount = ''.padEnd(43, 'target-0-');
    const targetAccountTags = [
      // Should return 0
      { name: 'Recipient', value: targetAccount },
      { name: 'Target', value: targetAccount },
      // happy path (owner calls for balance) should return 1
      { name: 'Recipient', value: STUB_ADDRESS },
      { name: 'Target', value: STUB_ADDRESS },
      null, // "equivalent to "from"
    ];

    for (const targetAccountTag of targetAccountTags) {
      const result = await handle({
        Tags: [
          { name: 'Action', value: 'Balance' },
          ...(targetAccountTag ? [targetAccountTag] : []),
        ],
      });
      const tags = result.Messages[0].Tags;
      const ref = tags.find((t) => t.name === 'X-Reference')?.value;

      const balanceData = result.Messages[0].Data;
      const balanceTag = tags.find((t) => t.name === 'Balance')?.value;
      const ticker = tags.find((t) => t.name === 'Ticker')?.value;
      const account = tags.find((t) => t.name === 'Account')?.value;

      assert.strictEqual(typeof balanceData, 'string');
      assert.strictEqual(typeof balanceTag, 'string');
      assert.strictEqual(balanceData, balanceTag);
      assert.strictEqual(Number.isInteger(parseInt(balanceData)), true);
      assert.strictEqual(typeof ticker, 'string');
      assert.strictEqual(targetAccountTag?.value ?? STUB_ADDRESS, account);
      assert(ref, 'Not a reply message');
    }
  });

  it('should get the balances', async () => {
    /**
     * Assert each balance is a string and int,
     */
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Balances' }],
    });

    const tags = result.Messages[0].Tags;
    const ref = tags.find((t) => t.name === 'X-Reference')?.value;
    assert(ref, 'Not a reply message');

    for (const bal of Object.values(JSON.parse(result.Messages[0].Data))) {
      assert.strictEqual(typeof bal, 'string');
      assert.strictEqual(Number.isInteger(parseInt(bal)), true);
    }
  });

  it('should transfer', async () => {
    /**
     * Check as:
     * - Owner (sufficient balance)
     * - Not owner (will send error message)
     */
    const recipient = ''.padEnd(43, 'recipient-1');
    const result = await handle({
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: recipient },
      ],
    });

    const creditNotice = result.Messages.find(({ Tags }) =>
      Tags.find((t) => t.name === 'Action' && t.value === 'Credit-Notice'),
    );
    assert(creditNotice, 'missing credit notice');
    const debitNotice = result.Messages.find(({ Tags }) =>
      Tags.find((t) => t.name === 'Action' && t.value === 'Debit-Notice'),
    );
    const ref = debitNotice.Tags.find((t) => t.name === 'X-Reference')?.value;
    assert(ref, 'Credit notice is not a reply message');
    assert(debitNotice, 'Missing debit notice');

    const infoRes = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      result.Memory,
    );
    const ownerAfterTransfer = infoRes.Messages[0].Tags.find(
      (t) => t.name === 'Owner',
    )?.value;
    assert.strictEqual(
      ownerAfterTransfer,
      recipient,
      'Owner after transfer not equal to recipient',
    );

    // non owner transfer
    const badResult = await handle({
      From: recipient,
      Owner: recipient,
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: STUB_ADDRESS },
      ],
    });

    // should return an insufficient funds error
    const errorMessage = badResult.Messages[0];
    const errorRef = debitNotice.Tags.find(
      (t) => t.name === 'X-Reference',
    )?.value;
    assert(errorRef, 'Error notice is not a reply message');
    const errorTag = errorMessage.Tags.find((t) => t.name === 'Error');
    assert.strictEqual(errorTag.value, 'Insufficient Balance!');
    const errorActionTag = errorMessage.Tags.find((t) => t.name === 'Action');
    assert.strictEqual(errorActionTag.value, 'Transfer-Error');
  });

  it('should get the total supply', async () => {
    /**
     * Check:
     * - data for supply (string int)
     * - action is Total-Supply
     * - Ticker tag
     * - response is reply
     */
    const result = await handle({
      From: ''.padEnd(43, 'rando'),
      Owner: ''.padEnd(43, 'rando'),
      Tags: [{ name: 'Action', value: 'Total-Supply' }],
    });

    const totalSupply = result.Messages[0];
    const ref = totalSupply.Tags.find((t) => t.name === 'X-Reference')?.value;
    assert(ref, 'Total supply is not a reply message');
    const action = totalSupply.Tags.find((t) => t.name === 'Action');
    const ticker = totalSupply.Tags.find((t) => t.name === 'Ticker');
    assert.strictEqual(action.value, 'Total-Supply');
    assert.strictEqual(typeof ticker.value, 'string');
    assert.strictEqual(typeof totalSupply.Data, 'string');
    assert.strictEqual(Number.isInteger(parseInt(totalSupply.Data)), true);
  });
});
