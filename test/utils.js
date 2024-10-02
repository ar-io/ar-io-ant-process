const AoLoader = require('@permaweb/ao-loader');
const {
  AOS_WASM,
  AO_LOADER_HANDLER_ENV,
  AO_LOADER_OPTIONS,
  BUNDLED_AOS_ANT_LUA,
  DEFAULT_HANDLE_OPTIONS,
  ANT_EVAL_OPTIONS,
} = require('../tools/constants');
const Arweave = require('arweave');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

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

async function createAntAosLoader(id) {
  if (id) {
    const luaCode = await getLuaCodeFromTxId(id);
    const { handle: originalHandle, memory: originalMemory } =
      await createAosLoader({
        ...ANT_EVAL_OPTIONS,
        Data: luaCode,
      });

    // reset the source id to template string
    const freshStateRes = await originalHandle(
      originalMemory,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...ANT_EVAL_OPTIONS,
        Data: 'SourceCodeTxId = "__INSERT_SOURCE_CODE_ID__"',
      },
      AO_LOADER_HANDLER_ENV,
    );

    const currentLuaCodeEvalRes = await originalHandle(
      freshStateRes.Memory,
      {
        ...DEFAULT_HANDLE_OPTIONS,
        ...ANT_EVAL_OPTIONS,
      },
      AO_LOADER_HANDLER_ENV,
    );

    return { handle: originalHandle, memory: currentLuaCodeEvalRes.Memory };
  }
  return createAosLoader(ANT_EVAL_OPTIONS);
}

function getPublishedSourceCodeIds() {
  // Read all filenames from the changelogs directory
  const changeLogFileNames = fs.readdirSync(
    path.join(__dirname, '../changelogs'),
  );

  // Process each file name to extract the source code ID
  const txIds = changeLogFileNames
    .map((fileName) => {
      // Remove the date portion at the start, which is in the format YYYY-MM-DD-
      const parts = fileName.split('-').slice(3); // Skip the first 3 parts (YYYY, MM, DD)
      const idWithExtension = parts.join('-'); // Join the remaining parts in case the ID itself has dashes
      const txId = idWithExtension.split('.').shift(); // Remove the file extension (e.g., .md)

      return txId;
    })
    .filter((txId) => txId.length === 43); // Filter for valid IDs with length 43

  return txIds;
}
async function getLuaCodeFromTxId(
  txId,
  arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  }),
) {
  const luaCode = await arweave.transactions.getData(txId, {
    decode: true,
    string: true,
  });
  assert(luaCode);
  return luaCode;
}

module.exports = {
  createAntAosLoader,
  createAosLoader,
  getPublishedSourceCodeIds,
  getLuaCodeFromTxId,
};
