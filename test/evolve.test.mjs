import { createAntAosLoader, createHandleWrapper } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  BUNDLED_AOS_ANT_LUA,
  AOS_ANT_OLD_WASM,
} from '../tools/constants.mjs';

describe('aos Evolve', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  const handle = createHandleWrapper(originalHandle, startMemory);

  // No longer needed, we have removed the eval handler for security purposes to be compatible with the ArNS Marketplace
  it.skip('should evolve the ant and retain eval ability', async () => {
    const evolveResult = await handle({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: BUNDLED_AOS_ANT_LUA,
    });

    console.dir(evolveResult, { depth: null });

    const result = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      evolveResult.Memory,
    );
    const state = JSON.parse(result.Messages[0].Data);
    assert(state);

    const evalResult = await handle(
      {
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: 'Handlers.list',
      },
      evolveResult.Memory,
    );

    console.dir(evalResult, { depth: null });

    assert(evalResult.Output.data);
    assert(evalResult.Output.data.includes('info'));
  });

  it('should error if eval is called', async () => {
    // The removal/override of the handler is baked into the module, so we should expect an error if eval is called
    const evolveResult = await handle({
      Tags: [
        { name: 'Action', value: 'Eval' },
        // omit src code id
      ],
      Data: "Foo = 'bar'",
    });

    assert(
      evolveResult.Error.includes('Eval is disabled for this process'),
      'Expected Eval is disabled for this process error',
    );
  });

  it('should not evolve the ant with correct tags called by a non owner', async () => {
    const evolveResult = await handle({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: "Foo = 'bar'",
      Owner: 'im-not-the-owner-'.padEnd(43, 'a'),
    });

    const result = await handle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      evolveResult.Memory,
    );

    const state = JSON.parse(result.Messages[0].Data);
    assert(state);

    const fooRes = await handle(
      {
        Tags: [
          {
            name: 'Action',
            value: 'Eval',
          },
        ],
        Data: 'print(Foo)',
      },
      result.Memory,
    );

    assert(!fooRes.Output?.output?.includes('bar'));
  });

  // No longer needed, will handle this as a different pattern elsewhere (sdk/arns portal)
  it.skip('should evolve the old aos-ant module for backwards compatibility', async () => {
    const { handle: tempOriginalHandle, memory: tempStartMemory } =
      await createAntAosLoader(AOS_ANT_OLD_WASM);

    const tempHandle = createHandleWrapper(tempOriginalHandle, tempStartMemory);

    const evolveResult = await tempHandle({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: BUNDLED_AOS_ANT_LUA,
    });

    const result = await tempHandle(
      {
        Tags: [{ name: 'Action', value: 'Info' }],
      },
      evolveResult.Memory,
    );
    const state = JSON.parse(result.Messages[0].Data);
    assert(state);

    const evalResult = await tempHandle(
      {
        Tags: [{ name: 'Action', value: 'Eval' }],
        Data: 'Handlers.list',
      },
      evolveResult.Memory,
    );

    assert(evalResult.Output.data);
    assert(evalResult.Output.data.includes('info'));
  });
});
