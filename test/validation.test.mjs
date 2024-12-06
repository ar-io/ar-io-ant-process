import { createAntAosLoader } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AO_LOADER_HANDLER_ENV,
  DEFAULT_HANDLE_OPTIONS,
  STUB_ADDRESS,
} from '../tools/constants.mjs';

describe('aos Validate', async () => {
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

  it('should validate Transfer', async () => {
    const messages = {
      Transfer: {
        ...DEFAULT_HANDLE_OPTIONS,
        Tags: [
          { name: 'Action', value: 'Transfer' },
          { name: 'Recipient', value: 'STUB_ADDRESS'.padEnd(43, '1') },
        ],
      },
      Transfer2: {
        ...DEFAULT_HANDLE_OPTIONS,
        Tags: [
          { name: 'Action', value: 'Transfer' },
          { name: 'Recipient', value: 'STUB_ADDRESS'.padEnd(43, '1') },
        ],
      },
    };

    const res = await handle({
      Tags: [{ name: 'Action', value: 'Validate-Handlers' }],
      Data: JSON.stringify(messages),
    });

    console.dir(JSON.parse(res.Messages[0].Data), { depth: null });
  });
});
