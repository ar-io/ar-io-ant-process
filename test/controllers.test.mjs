import { assertPatchMessage, createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
  STUB_ETH_ADDRESS,
} from '../tools/constants.mjs';

describe('aos Controllers', async () => {
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

  async function getControllers(mem = startMemory) {
    return handle(
      {
        Tags: [{ name: 'Action', value: 'Controllers' }],
      },
      mem,
    );
  }

  it('should get the controllers', async () => {
    const result = await handle({
      Tags: [{ name: 'Action', value: 'Controllers' }],
    });

    const controllers = JSON.parse(result.Messages[0].Data);
    assert(controllers);
    assert(controllers.includes(STUB_ADDRESS));
  });
  const stubController = ''.padEnd(43, 'controller');
  for (const [target_address, allowUnsafe, shouldPass] of [
    [stubController, undefined, true],
    [stubController, true, true],
    [stubController, false, true],
    [STUB_ETH_ADDRESS, undefined, true],
    [STUB_ETH_ADDRESS, true, true],
    [STUB_ETH_ADDRESS, false, true],
    ['invalid-address', true, true],
    ['invalid-address', false, false],
    ['invalid-address', false, false],
  ]) {
    it(`should ${shouldPass ? 'add' : 'not add'} the controller ${target_address}`, async () => {
      // Get controllers list before the operation
      const controllersBefore = await getControllers();
      const controllersListBefore = JSON.parse(
        controllersBefore.Messages[0].Data,
      );

      const result = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      if (shouldPass === true) {
        assert(
          JSON.parse(result.Messages[0].Data).includes(target_address),
          shouldPass,
        );
      } else {
        assert.strictEqual(
          result.Messages[0].Tags.find((t) => t.name === 'Error')?.value,
          'Add-Controller-Error',
        );

        // Verify that controllers list wasn't modified on invalid add-controller
        const controllersAfter = await getControllers(result.Memory);
        const controllersListAfter = JSON.parse(
          controllersAfter.Messages[0].Data,
        );
        assert.deepStrictEqual(
          controllersListAfter,
          controllersListBefore,
          'Controllers list should not change on invalid add-controller operation',
        );
      }
    });

    it(`should ${shouldPass ? 'remove' : 'not remove'} the controller ${target_address}`, async () => {
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: allowUnsafe },
        ],
      });

      assertPatchMessage(addControllerResult);

      // Get controllers list before remove operation
      const controllersBefore = await getControllers(
        addControllerResult.Memory,
      );
      const controllersListBefore = JSON.parse(
        controllersBefore.Messages[0].Data,
      );

      const removeControllerResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Remove-Controller' },
            { name: 'Controller', value: target_address },
          ],
        },
        addControllerResult.Memory,
      );

      if (shouldPass) {
        assertPatchMessage(removeControllerResult);

        const controllersRes = await getControllers(
          removeControllerResult.Memory,
        );
        assert.strictEqual(
          !JSON.parse(controllersRes.Messages[0].Data).includes(target_address),
          shouldPass,
        );
      } else {
        // Verify that controllers list wasn't modified on invalid remove-controller
        const controllersAfter = await getControllers(
          removeControllerResult.Memory,
        );
        const controllersListAfter = JSON.parse(
          controllersAfter.Messages[0].Data,
        );

        assert.deepStrictEqual(
          controllersListAfter,
          controllersListBefore,
          `Controllers list should not change on invalid remove-controller operation. Params: ${target_address} ${allowUnsafe} ${shouldPass}`,
        );
      }
    });
  }

  it('should fail to remove controller when called by non-owner', async () => {
    const infoBefore = await getInfo(startMemory);
    const nonOwner = 'non-owner-'.padEnd(43, '1');
    assert.notEqual(
      nonOwner,
      infoBefore.Owner,
      'Non-owner parameter should not be the current owner',
    );
    const newController = 'new-controller-'.padEnd(43, '1');

    // add the controller which we will attempt to remove
    const addControllerResult = await handle({
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: newController },
      ],
    });

    const controllersBefore = await getControllers(addControllerResult.Memory);
    const controllersListBefore = JSON.parse(
      controllersBefore.Messages[0].Data,
    );

    // attempt to remove the controller which we added, but with an unauthorized caller
    const removeControllerResult = await handle(
      {
        From: nonOwner,
        Owner: nonOwner,
        Tags: [
          { name: 'Action', value: 'Remove-Controller' },
          { name: 'Controller', value: newController },
        ],
      },
      addControllerResult.Memory,
    );
    assert.strictEqual(removeControllerResult.Messages.length, 2);
    assertPatchMessage(removeControllerResult);
    assert.strictEqual(
      removeControllerResult.Messages[0].Tags.find((t) => t.name === 'Error')
        ?.value,
      'Remove-Controller-Error',
    );
    const controllersAfter = await getControllers(
      removeControllerResult.Memory,
    );
    const controllersListAfter = JSON.parse(controllersAfter.Messages[0].Data);
    assert.deepStrictEqual(
      controllersListAfter,
      controllersListBefore,
      'Controllers list should not change on invalid remove-controller operation',
    );
    assert.strictEqual(
      removeControllerResult.Messages[0].Tags.find((t) => t.name === 'Error')
        ?.value,
      'Remove-Controller-Error',
    );
  });

  it('should fail to add controller when called by non-owner', async () => {
    const infoBefore = await getInfo(startMemory);
    const nonOwner = 'non-owner-'.padEnd(43, '1');
    assert.notEqual(
      nonOwner,
      infoBefore.Owner,
      'Non-owner parameter should not be the current owner',
    );
    const newController = 'new-controller-'.padEnd(43, '1');

    const controllersBefore = await getControllers(startMemory);
    const controllersListBefore = JSON.parse(
      controllersBefore.Messages[0].Data,
    );

    const addControllerResult = await handle({
      From: nonOwner,
      Owner: nonOwner,
      Tags: [
        { name: 'Action', value: 'Add-Controller' },
        { name: 'Controller', value: newController },
      ],
    });
    assert.strictEqual(addControllerResult.Messages.length, 2);
    assertPatchMessage(addControllerResult);
    assert.strictEqual(
      addControllerResult.Messages[0].Tags.find((t) => t.name === 'Error')
        ?.value,
      'Add-Controller-Error',
    );
    const controllersAfter = await getControllers(addControllerResult.Memory);
    const controllersListAfter = JSON.parse(controllersAfter.Messages[0].Data);
    assert.deepStrictEqual(
      controllersListAfter,
      controllersListBefore,
      'Controllers list should not change on invalid add-controller operation',
    );
  });
});
