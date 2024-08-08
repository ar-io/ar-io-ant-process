const AoLoader = require('@permaweb/ao-loader');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  AOS_WASM,
  AO_LOADER_OPTIONS,
  ANT_EVAL_OPTIONS,
} = require('../tools/constants');

describe('first run actions', async () => {
  it('should register on eval of ANT code', async () => {
    const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);
    const evalRes = await handle(
      null,
      { ...DEFAULT_HANDLE_OPTIONS, ...ANT_EVAL_OPTIONS },
      AO_LOADER_HANDLER_ENV,
    );
    const stateNotice = JSON.parse(evalRes.Messages[0].Data);
    const registryId = evalRes.Messages[0].Target;
    assert(stateNotice);
    assert(registryId == 'ant-registry-'.padEnd(43, '1'));
  });

  it('should not register on subsequent evals', async () => {
    const handle = await AoLoader(AOS_WASM, AO_LOADER_OPTIONS);
    const evalRes = await handle(
      null,
      { ...DEFAULT_HANDLE_OPTIONS, ...ANT_EVAL_OPTIONS },
      AO_LOADER_HANDLER_ENV,
    );
    const stateNotice = JSON.parse(evalRes.Messages[0].Data);
    const registryId = evalRes.Messages[0].Target;
    assert(stateNotice);
    assert(registryId == 'ant-registry-'.padEnd(43, '1'));

    const evalRes2 = await handle(
      evalRes.Memory,
      { ...DEFAULT_HANDLE_OPTIONS, ...ANT_EVAL_OPTIONS },
      AO_LOADER_HANDLER_ENV,
    );

    assert(evalRes2.Messages[0] == undefined);
  });
});
