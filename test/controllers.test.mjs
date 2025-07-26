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
      }
    });

    it(`should remove the controller ${target_address}`, async () => {
      const addControllerResult = await handle({
        Tags: [
          { name: 'Action', value: 'Add-Controller' },
          { name: 'Controller', value: target_address },
          { name: 'Allow-Unsafe-Addresses', value: true },
        ],
      });

      assertPatchMessage(addControllerResult);

      const removeControllerResult = await handle(
        {
          Tags: [
            { name: 'Action', value: 'Remove-Controller' },
            { name: 'Controller', value: target_address },
          ],
        },
        addControllerResult.Memory,
      );

      assertPatchMessage(removeControllerResult);

      const controllersRes = await getControllers(
        removeControllerResult.Memory,
      );
      if (shouldPass) {
        assert.strictEqual(
          !JSON.parse(controllersRes.Messages[0].Data).includes(target_address),
          shouldPass,
        );
      }
    });
  }
});
