import AoLoader from '@permaweb/ao-loader';
import {
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  DEFAULT_HANDLE_OPTIONS,
  AOS_ANT_WASM,
} from '../tools/constants.mjs';
import assert from 'node:assert';

export async function createAntAosLoader(wasmModule = AOS_ANT_WASM) {
  const handle = await AoLoader(wasmModule, AO_LOADER_OPTIONS);
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

export function createHandleWrapper(
  ogHandle,
  startMem,
  defaultHandleOptions = DEFAULT_HANDLE_OPTIONS,
  aoLoaderHandlerEnv = AO_LOADER_HANDLER_ENV,
) {
  return async function (options = {}, mem = startMem) {
    return ogHandle(
      mem,
      {
        ...defaultHandleOptions,
        ...options,
      },
      aoLoaderHandlerEnv,
    );
  };
}

/**
 * Asserts that the result has a patch message and that the cache tag is present.
 *
 * These messages are used by HyperBeam nodes to provide cached state of ANTs. They are sent after all other messages and right now, include the full `getState()`.
 * @param {*} result
 */
export function assertPatchMessage(result) {
  assert(result.Messages?.length > 1, 'Expected more than one message');
  // patch should be the last message
  const patchMessage = result.Messages[result.Messages.length - 1];
  assert(
    patchMessage.Tags.some(
      (tag) => tag.name === 'device' && tag.value === 'patch@1.0',
    ),
    'Expected patch message on state change',
  );
  // should include the cache tag with the object with state as the value
  assert(
    patchMessage.Tags.some(
      (tag) => tag.name === 'cache' && tag.value !== undefined,
    ),
    'Expected cache tag in patch message',
  );
}
