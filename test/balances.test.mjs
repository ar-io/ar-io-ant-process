import { assertPatchMessage, createAntAosLoader } from './utils.mjs';
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
    // balance reading test
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
        assert.equal(typeof targetBalance === 'string', shouldPass);
      } else {
        assert.strictEqual(
          result.Messages[0].Tags.find((t) => t.name === 'Error')?.value,
          'Balance-Error',
        );
      }
    });

    // test for unsafe address handling
    it(`should ${allowUnsafe ? '' : 'not'} transfer the ANT`, async () => {
      // Get owner info before transfer
      const infoBefore = await getInfo(startMemory);

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
        assert.equal(balances[target_address] === '1', shouldPass);
      } else {
        // Verify that Owner doesn't change on transfer
        const infoAfter = await getInfo(transferResult.Memory);

        assert.strictEqual(
          infoAfter.Owner,
          infoBefore.Owner,
          'Owner should not change on invalid transfer',
        );
        assert.strictEqual(
          transferResult.Messages[0].Tags.find((t) => t.name === 'Error')
            ?.value,
          'Transfer-Error',
          `Expected Transfer-Error tag in response, got ${transferResult.Messages[0].Tags.find((t) => t.name === 'Error')?.value}`,
        );
      }
    });

    // test for credit and debit notice
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

  it('should fail to transfer when called by non-owner', async () => {
    const infoBefore = await getInfo(startMemory);
    const nonOwner = 'non-owner-'.padEnd(43, '1');
    assert.notEqual(
      nonOwner,
      infoBefore.Owner,
      'Non-owner parameter should not be the current owner',
    );
    const transferResult = await handle({
      From: nonOwner,
      Owner: nonOwner,
      Tags: [
        { name: 'Action', value: 'Transfer' },
        { name: 'Recipient', value: STUB_RECIPIENT },
      ],
    });

    assert.strictEqual(transferResult.Messages.length, 2);
    assertPatchMessage(transferResult);
    // note this is different because Action: Transfer-Error is from the token spec, and we are testing for Error: Insufficient Balance! which is also from the token spec
    assert.strictEqual(
      transferResult.Messages[0].Tags.find((t) => t.name === 'Action')?.value,
      'Transfer-Error',
      `Expected Transfer-Error action tag in response, got ${transferResult.Messages[0].Tags.find((t) => t.name === 'Action')?.value}`,
    );
    assert.strictEqual(
      transferResult.Messages[0].Tags.find((t) => t.name === 'Error')?.value,
      'Insufficient Balance!',
      `Expected Insufficient Balance! error tag in response, got ${transferResult.Messages[0].Tags.find((t) => t.name === 'Error')?.value}`,
    );
    const infoAfter = await getInfo(transferResult.Memory);
    assert.strictEqual(
      infoAfter.Owner,
      infoBefore.Owner,
      'Owner should not change on invalid transfer',
    );
  });

  // test for balances
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
    assert(ownerBalance === '1');
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
  it('should get total supply', async () => {
    const res = await getTotalSupply();
    assert.strictEqual(res, '1', 'total supply should be equal to 1');
  });

  describe('Transfer with Remove-Controllers', () => {
    const STUB_NEW_OWNER = 'new-owner-'.padEnd(43, '1');
    const STUB_CONTROLLER = 'controller-'.padEnd(43, '1');

    async function getControllers(mem) {
      const result = await handle(
        {
          Tags: [{ name: 'Action', value: 'Controllers' }],
        },
        mem,
      );
      return JSON.parse(result.Messages[0].Data);
    }

    it('should remove all controllers when transferring with Remove-Controllers tag', async () => {
      // Add a controller first
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: STUB_CONTROLLER },
        ],
      });

      // Verify controller was added
      const controllersBeforeTransfer = await getControllers(
        addControllerResult.Memory,
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER),
        'Controller should be added before transfer',
      );
      assert(
        controllersBeforeTransfer.length > 0,
        'Should have at least one controller',
      );

      // Transfer with Remove-Controllers tag
      const transferResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Transfer' },
            { name: 'Recipient', value: STUB_NEW_OWNER },
            { name: 'Remove-Controllers', value: 'true' },
          ],
        },
        addControllerResult.Memory,
      );

      // Verify transfer was successful
      assert(
        !transferResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Transfer should succeed',
      );

      // Verify controllers were removed
      const controllersAfterTransfer = await getControllers(
        transferResult.Memory,
      );
      assert.strictEqual(
        controllersAfterTransfer.length,
        0,
        'All controllers should be removed after transfer with Remove-Controllers tag',
      );

      // Verify owner changed
      const infoAfter = await getInfo(transferResult.Memory);
      assert.strictEqual(
        infoAfter.Owner,
        STUB_NEW_OWNER,
        'Owner should be updated to new owner',
      );
    });

    it('should remove controllers by default when transferring WITHOUT Remove-Controllers tag', async () => {
      // Add a controller first
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: STUB_CONTROLLER },
        ],
      });

      // Verify controller was added
      const controllersBeforeTransfer = await getControllers(
        addControllerResult.Memory,
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER),
        'Controller should be added before transfer',
      );
      assert(
        controllersBeforeTransfer.length > 0,
        'Should have at least one controller',
      );

      // Transfer WITHOUT Remove-Controllers tag (defaults to true)
      const transferResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Transfer' },
            { name: 'Recipient', value: STUB_NEW_OWNER },
          ],
        },
        addControllerResult.Memory,
      );

      // Verify transfer was successful
      assert(
        !transferResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Transfer should succeed',
      );

      // Verify controllers were removed (default behavior)
      const controllersAfterTransfer = await getControllers(
        transferResult.Memory,
      );
      assert.strictEqual(
        controllersAfterTransfer.length,
        0,
        'Controllers should be removed by default when Remove-Controllers tag is not present',
      );

      // Verify owner changed
      const infoAfter = await getInfo(transferResult.Memory);
      assert.strictEqual(
        infoAfter.Owner,
        STUB_NEW_OWNER,
        'Owner should be updated to new owner',
      );
    });

    it('should remove controllers when Remove-Controllers value is empty string (defaults to true)', async () => {
      // Add a controller first
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: STUB_CONTROLLER },
        ],
      });

      // Verify controller was added
      const controllersBeforeTransfer = await getControllers(
        addControllerResult.Memory,
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER),
        'Controller should be added before transfer',
      );

      // Transfer with Remove-Controllers tag (empty string value)
      // When tag is present, it defaults to true unless explicitly "false"
      const transferResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Transfer' },
            { name: 'Recipient', value: STUB_NEW_OWNER },
            { name: 'Remove-Controllers', value: '' },
          ],
        },
        addControllerResult.Memory,
      );

      // Verify transfer was successful
      assert(
        !transferResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Transfer should succeed',
      );

      // Verify controllers were removed (defaults to true when tag is present)
      const controllersAfterTransfer = await getControllers(
        transferResult.Memory,
      );
      assert.strictEqual(
        controllersAfterTransfer.length,
        0,
        'All controllers should be removed when Remove-Controllers tag is present (defaults to true)',
      );
    });

    it('should NOT remove controllers when Remove-Controllers is explicitly set to "false"', async () => {
      // Add a controller first
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: STUB_CONTROLLER },
        ],
      });

      // Verify controller was added
      const controllersBeforeTransfer = await getControllers(
        addControllerResult.Memory,
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER),
        'Controller should be added before transfer',
      );
      const controllerCountBefore = controllersBeforeTransfer.length;

      // Transfer with Remove-Controllers tag explicitly set to "false"
      const transferResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Transfer' },
            { name: 'Recipient', value: STUB_NEW_OWNER },
            { name: 'Remove-Controllers', value: 'false' },
          ],
        },
        addControllerResult.Memory,
      );

      // Verify transfer was successful
      assert(
        !transferResult.Messages[0].Tags.find((t) => t.name === 'Error'),
        'Transfer should succeed',
      );

      // Verify controllers were NOT removed
      const controllersAfterTransfer = await getControllers(
        transferResult.Memory,
      );
      assert.strictEqual(
        controllersAfterTransfer.length,
        controllerCountBefore,
        'Controllers should NOT be removed when Remove-Controllers is explicitly "false"',
      );
      assert(
        controllersAfterTransfer.includes(STUB_CONTROLLER),
        'Original controller should still be present',
      );

      // Verify owner changed
      const infoAfter = await getInfo(transferResult.Memory);
      assert.strictEqual(
        infoAfter.Owner,
        STUB_NEW_OWNER,
        'Owner should be updated to new owner',
      );
    });

    it('should remove multiple controllers when transferring with Remove-Controllers tag', async () => {
      const STUB_CONTROLLER_2 = 'controller2-'.padEnd(43, '2');
      const STUB_CONTROLLER_3 = 'controller3-'.padEnd(43, '3');

      // Get initial controller count
      const initialControllers = await getControllers(startMemory);
      const initialCount = initialControllers.length;

      // Add multiple controllers
      let currentMemory = startMemory;
      for (const controller of [
        STUB_CONTROLLER,
        STUB_CONTROLLER_2,
        STUB_CONTROLLER_3,
      ]) {
        const addResult = await handle(
          {
            Tags: [
              { name: 'Action', value: 'Add-Controller' },
              { name: 'Controller', value: controller },
            ],
          },
          currentMemory,
        );
        currentMemory = addResult.Memory;
      }

      // Verify all controllers were added
      const controllersBeforeTransfer = await getControllers(currentMemory);
      assert.strictEqual(
        controllersBeforeTransfer.length,
        initialCount + 3,
        `Should have ${initialCount + 3} controllers (${initialCount} initial + 3 added)`,
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER),
        'Controller 1 should be present',
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER_2),
        'Controller 2 should be present',
      );
      assert(
        controllersBeforeTransfer.includes(STUB_CONTROLLER_3),
        'Controller 3 should be present',
      );

      // Transfer with Remove-Controllers tag
      const transferResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Transfer' },
            { name: 'Recipient', value: STUB_NEW_OWNER },
            { name: 'Remove-Controllers', value: 'true' },
          ],
        },
        currentMemory,
      );

      // Verify all controllers were removed
      const controllersAfterTransfer = await getControllers(
        transferResult.Memory,
      );
      assert.strictEqual(
        controllersAfterTransfer.length,
        0,
        'All controllers should be removed after transfer with Remove-Controllers tag',
      );
    });
  });
});
