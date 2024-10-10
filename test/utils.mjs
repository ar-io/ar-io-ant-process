const AoLoader = require('@permaweb/ao-loader');
const {
  AOS_WASM,
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  BUNDLED_AOS_ANT_LUA,
  DEFAULT_HANDLE_OPTIONS,
  ANT_EVAL_OPTIONS,
} = require('../tools/constants');

/**
 * Loads the aos wasm binary and returns the handle function with program memory
 * @returns {Promise<{handle: Function, memory: WebAssembly.Memory}>}
 */
async function createAosLoader(params) {
  const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);
  const evalRes = await handle(
    null,
    { ...DEFAULT_HANDLE_OPTIONS, ...params },
    AO_LOADER_HANDLER_ENV,
  );
  return {
    handle,
    memory: evalRes.Memory,
  };
}

async function createAntAosLoader() {
  return createAosLoader(ANT_EVAL_OPTIONS);
}

module.exports = {
  createAntAosLoader,
  createAosLoader,
};
