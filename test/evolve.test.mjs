import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  BUNDLED_AOS_ANT_LUA,
} from '../tools/constants.mjs';

describe('aos Evolve', async () => {
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

  it('should evolve the ant and retain eval ability', async () => {
    const evolveResult = await handle({
      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: BUNDLED_AOS_ANT_LUA,
    });

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

    assert(evalResult.Output.data);
    assert(evalResult.Output.data.includes('info'));
  });

  it('should not evolve the ant', async () => {
    const evolveResult = await handle({
      Tags: [
        { name: 'Action', value: 'Eval' },
        // omit src code id
      ],
      Data: "Foo = 'bar'",
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

    assert(!fooRes.Output.output?.includes('bar'));
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
});
