import { createAntAosLoader, createHandleWrapper } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ingress-json-memory-limits', async () => {
  // Don't create handle here - we'll create fresh ones for each test to avoid memory accumulation

  /**
   * Creates a JSON payload with the specified number of records
   * @param {number} recordCount - Number of records to create
   * @returns {string} JSON string
   */
  function createJsonPayload(recordCount) {
    const records = {};
    const controllers = [];
    const balances = {};

    for (let i = 0; i < recordCount; i++) {
      const recordName = `record-${i}`;

      // Base record structure
      const record = {
        transactionId: ''.padEnd(43, '1'), // Valid Arweave address format
        ttlSeconds: 900, // Within valid range (60-86400)
      };

      // Add optional metadata fields for variety (following validation constraints)
      if (i % 10 === 0) {
        // Add priority for some records (must be > 0 for non-@ records)
        record.priority = Math.floor(i / 10) + 1;
      }

      if (i % 5 === 0) {
        // Add owner for some records (valid AO address format)
        record.owner = ''.padEnd(43, (i % 10).toString());
      }

      if (i % 7 === 0) {
        // Add displayName (max 61 characters)
        record.displayName = `Display Name ${i}`.substring(0, 61);
      }

      if (i % 11 === 0) {
        // Add logo (valid Arweave address)
        record.logo = ''.padEnd(43, '2');
      }

      if (i % 13 === 0) {
        // Add description (max 512 characters)
        record.description = `This is a test description for record ${i}. `
          .repeat(3)
          .substring(0, 512);
      }

      if (i % 17 === 0) {
        // Add keywords (max 16 keywords, each max 32 chars)
        const keywordCount = Math.min(Math.floor(i / 17) + 1, 16);
        record.keywords = Array.from({ length: keywordCount }, (_, idx) =>
          `keyword${idx}`.substring(0, 32),
        );
      }

      records[recordName] = record;

      const controller = ''.padEnd(43, i.toString().padStart(2, '0'));
      controllers.push(controller);
      balances[controller] = 1;
    }

    return JSON.stringify({
      records,
      controllers,
      balances,
    });
  }

  /**
   * Tests if a JSON payload can be parsed successfully
   * Creates a fresh handle for each test to avoid memory accumulation
   * @param {string} data - JSON data to test
   * @returns {Promise<boolean>} true if successful, false if error
   */
  async function testJsonParsing(data) {
    try {
      // Create a fresh handle for each test to avoid memory accumulation
      const { handle: originalHandle, memory: startMemory } =
        await createAntAosLoader();
      const handle = createHandleWrapper(originalHandle, startMemory);

      const result = await handle({
        Data: data,
        Tags: [{ name: 'Content-Type', value: 'application/json' }],
      });

      // Log the result for debugging
      if (result.Error) {
        console.log(`    Result Error: ${result.Error}`);
        return false;
      }

      // Check for any error messages
      if (
        result.Messages &&
        result.Messages.some(
          (msg) => msg.Tags && msg.Tags.some((tag) => tag.name === 'Error'),
        )
      ) {
        console.log(`    Message Error found in result`);
        return false;
      }

      return true;
    } catch (error) {
      console.log(`    Exception: ${error.message}`);
      return false;
    }
  }

  it('should discover the maximum JSON ingress memory limits', async () => {
    console.log('🔍 Starting JSON limit discovery...');

    // First, verify that a small payload works to ensure our setup is correct
    console.log('🧪 Verification: Testing small payload...');
    const smallPayload = createJsonPayload(10);
    const smallTest = await testJsonParsing(smallPayload);
    if (!smallTest) {
      throw new Error(
        'Even small JSON payloads are failing - check test setup',
      );
    }
    console.log('✅ Small payload test passed');

    // Start at 13k and work down to find the exact limit for enriched records
    console.log(
      '🎯 Starting at 13k records and decrementing by 100 until success...',
    );

    let currentRecordCount = 13000;
    let exactLimit = 0;

    while (currentRecordCount > 0) {
      console.log(`Testing ${currentRecordCount.toLocaleString()} records...`);
      const jsonData = createJsonPayload(currentRecordCount);
      const sizeInMB = (
        Buffer.byteLength(jsonData, 'utf8') /
        1024 /
        1024
      ).toFixed(2);
      console.log(`  JSON size: ${sizeInMB} MB`);

      const success = await testJsonParsing(jsonData);

      if (success) {
        console.log(
          `  ✅ SUCCESS! Found working limit: ${currentRecordCount.toLocaleString()} records (${sizeInMB} MB)`,
        );
        exactLimit = currentRecordCount;
        break;
      } else {
        console.log(
          `  ❌ Failed with ${currentRecordCount.toLocaleString()} records`,
        );
        currentRecordCount -= 100;
      }
    }

    // Final verification with a few counts around the limit
    console.log(
      `\n🔬 Final verification around limit of ${exactLimit.toLocaleString()} records`,
    );

    const testCounts = [
      exactLimit - 50,
      exactLimit,
      exactLimit + 50,
      exactLimit + 100,
    ].filter((count) => count > 0);

    for (const count of testCounts) {
      const jsonData = createJsonPayload(count);
      const sizeInMB = (
        Buffer.byteLength(jsonData, 'utf8') /
        1024 /
        1024
      ).toFixed(2);
      const success = await testJsonParsing(jsonData);

      console.log(
        `  ${success ? '✅' : '❌'} ${count.toLocaleString()} records (${sizeInMB} MB): ${success ? 'SUCCESS' : 'FAILED'}`,
      );
    }

    console.log(
      `\n🏁 FINAL RESULT: Maximum JSON parsing limit is approximately ${exactLimit.toLocaleString()} records`,
    );

    const finalJsonData = createJsonPayload(exactLimit);
    const finalSizeInMB = (
      Buffer.byteLength(finalJsonData, 'utf8') /
      1024 /
      1024
    ).toFixed(2);
    console.log(
      `📊 This corresponds to approximately ${finalSizeInMB} MB of JSON data`,
    );

    // Assert that we found a reasonable limit (should be at least the 10k from the original test)
    assert(
      exactLimit >= 10000,
      `Expected limit to be at least 10,000 records, got ${exactLimit}`,
    );

    // Test the exact limit one more time to ensure our result is correct
    const finalTest = await testJsonParsing(finalJsonData);
    assert(
      finalTest,
      `Final verification failed - limit of ${exactLimit} records should work`,
    );

    return exactLimit;
  });
});
