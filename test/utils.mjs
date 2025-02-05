import AoLoader from '@permaweb/ao-loader';
import {
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  DEFAULT_HANDLE_OPTIONS,
  AOS_ANT_WASM,
} from '../tools/constants.mjs';

export async function createAntAosLoader() {
  const handle = await AoLoader(AOS_ANT_WASM, AO_LOADER_OPTIONS);
  // just to get the mem buffer originally
  const evalRes = await handle(
    null,
    {
      ...DEFAULT_HANDLE_OPTIONS,

      Tags: [{ name: 'Action', value: 'Eval' }],
      Data: "print('foo')",
    },

    AO_LOADER_HANDLER_ENV,
  );

  return {
    handle,
    memory: evalRes.Memory,
  };
}
