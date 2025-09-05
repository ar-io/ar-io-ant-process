import { createAntAosLoader, createHandleWrapper } from './utils.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('egress-json-memory-limits', async () => {
  const { handle: originalHandle, memory: startMemory } =
    await createAntAosLoader();

  const handle = createHandleWrapper(originalHandle, startMemory);

  /**
   * Adds a single record with enriched metadata
   * @param {string} recordName - Name of the record
   * @param {number} index - Index for generating unique data
   * @param {object} currentMemory - Current memory state
   * @returns {Promise<object>} Updated memory state
   */
  async function addRecord(recordName, index, currentMemory) {
    // Create enriched record data similar to ingress test
    const transactionId = ''.padEnd(43, '1');
    const ttlSeconds = 900;

    // Add optional metadata fields for variety (following validation constraints)
    const tags = [
      { name: 'Action', value: 'Set-Record' },
      { name: 'Sub-Domain', value: recordName },
      { name: 'Transaction-Id', value: transactionId },
      { name: 'TTL-Seconds', value: ttlSeconds.toString() },
    ];

    // Add optional metadata fields based on index
    if (index % 10 === 0) {
      // Add priority for some records (must be > 0 for non-@ records)
      tags.push({
        name: 'Priority',
        value: (Math.floor(index / 10) + 1).toString(),
      });
    }

    if (index % 5 === 0) {
      // Add owner for some records (valid AO address format)
      tags.push({
        name: 'Owner',
        value: ''.padEnd(43, (index % 10).toString()),
      });
    }

    if (index % 7 === 0) {
      // Add displayName (max 61 characters)
      tags.push({
        name: 'Name',
        value: `Display Name ${index}`.substring(0, 61),
      });
    }

    if (index % 11 === 0) {
      // Add logo (valid Arweave address)
      tags.push({ name: 'Logo', value: ''.padEnd(43, '2') });
    }

    if (index % 13 === 0) {
      // Add description (max 512 characters)
      tags.push({
        name: 'Description',
        value: `This is a test description for record ${index}. `
          .repeat(3)
          .substring(0, 512),
      });
    }

    if (index % 17 === 0) {
      // Add keywords (max 16 keywords, each max 32 chars)
      const keywordCount = Math.min(Math.floor(index / 17) + 1, 16);
      const keywords = Array.from({ length: keywordCount }, (_, idx) =>
        `keyword${idx}`.substring(0, 32),
      );
      tags.push({ name: 'Keywords', value: JSON.stringify(keywords) });
    }

    const result = await handle(
      {
        Tags: tags,
      },
      currentMemory,
    );

    if (result.Error) {
      throw new Error(`Failed to add record ${recordName}: ${result.Error}`);
    }

    return result.Memory;
  }

  /**
   * Tests if we can successfully call State and get JSON response
   * @param {object} currentMemory - Current memory state
   * @returns {Promise<{success: boolean, sizeInMB: number, recordCount: number}>}
   */
  async function testStateCall(currentMemory) {
    try {
      const result = await handle(
        {
          Tags: [{ name: 'Action', value: 'State' }],
        },
        currentMemory,
      );

      if (result.Error) {
        console.log(`    State Error: ${result.Error}`);
        return { success: false, sizeInMB: 0, recordCount: 0 };
      }

      // Check for any error messages
      if (
        result.Messages &&
        result.Messages.some(
          (msg) => msg.Tags && msg.Tags.some((tag) => tag.name === 'Error'),
        )
      ) {
        console.log(`    Message Error found in State result`);
        return { success: false, sizeInMB: 0, recordCount: 0 };
      }

      // Get the state data from the message
      const stateMessage = result.Messages && result.Messages[0];
      if (!stateMessage || !stateMessage.Data) {
        console.log(`    No state data in response`);
        return { success: false, sizeInMB: 0, recordCount: 0 };
      }

      const sizeInMB = (
        Buffer.byteLength(stateMessage.Data, 'utf8') /
        1024 /
        1024
      ).toFixed(2);

      // Parse the state to count records
      let recordCount = 0;
      try {
        const state = JSON.parse(stateMessage.Data);
        recordCount = state.records ? Object.keys(state.records).length : 0;
      } catch (parseError) {
        console.log(`    Failed to parse state JSON: ${parseError.message}`);
        return {
          success: false,
          sizeInMB: parseFloat(sizeInMB),
          recordCount: 0,
        };
      }

      return {
        success: true,
        sizeInMB: parseFloat(sizeInMB),
        recordCount,
        memory: result.Memory,
      };
    } catch (error) {
      console.log(`    Exception during State call: ${error.message}`);
      return { success: false, sizeInMB: 0, recordCount: 0 };
    }
  }

  it('should discover the maximum JSON egress memory limits', async () => {
    console.log('🔍 Starting egress JSON memory limit discovery...');

    let currentMemory = startMemory;
    let recordCount = 0;
    let lastSuccessfulCount = 0;
    let lastSuccessfulSize = 0;

    // Memory expansion tracking
    let lastMemorySize = (startMemory.byteLength / 1024 / 1024).toFixed(1);
    let lastMemoryChangeRecordCount = 0;

    console.log(`🚀 Starting with ${lastMemorySize}MB memory`);

    // Phase 1: Build up to 9000 records first
    console.log('📈 Phase 1: Building up to 9000 records...');

    let lastLogTime = performance.now();
    let lastLogCount = 0;

    while (recordCount < 9000) {
      const recordName = `record-${recordCount}`;

      try {
        const startTime = performance.now();
        currentMemory = await addRecord(recordName, recordCount, currentMemory);
        const addTime = performance.now() - startTime;
        recordCount++;

        // Check for memory expansion
        const currentMemorySizeMB = (
          currentMemory.byteLength /
          1024 /
          1024
        ).toFixed(1);
        if (currentMemorySizeMB !== lastMemorySize) {
          const recordsSinceLastExpansion =
            recordCount - lastMemoryChangeRecordCount;
          const expansionAmountMB = (
            parseFloat(currentMemorySizeMB) - parseFloat(lastMemorySize)
          ).toFixed(1);
          console.log(
            `    🔥 MEMORY EXPANSION: ${lastMemorySize}MB → ${currentMemorySizeMB}MB (+${expansionAmountMB}MB) after ${recordsSinceLastExpansion} records`,
          );
          lastMemorySize = currentMemorySizeMB;
          lastMemoryChangeRecordCount = recordCount;
        }

        // Log progress every 10 records with timing info
        if (recordCount % 10 === 0) {
          const currentTime = performance.now();
          const batchTime = currentTime - lastLogTime;
          const recordsPerSecond = (
            (recordCount - lastLogCount) /
            (batchTime / 1000)
          ).toFixed(1);

          console.log(
            `  Added ${recordCount.toLocaleString()} records... (last 10 took ${batchTime.toFixed(1)}ms, ${recordsPerSecond} records/sec, last record: ${addTime.toFixed(1)}ms, memory: ${currentMemorySizeMB}MB)`,
          );

          lastLogTime = currentTime;
          lastLogCount = recordCount;
        }
      } catch (error) {
        console.log(
          `  ❌ Failed to add record at ${recordCount}: ${error.message}`,
        );
        break;
      }
    }

    console.log(
      `✅ Successfully added ${recordCount.toLocaleString()} records`,
    );

    // Phase 2: Add records in batches of 300 and test State call each time
    console.log(
      `\n🎯 Phase 2: Adding records in batches of 300 and testing State calls...`,
    );

    while (true) {
      // Add 300 records
      const targetCount = recordCount + 300;
      let addedSuccessfully = true;

      console.log(`Adding records ${recordCount + 1} to ${targetCount}...`);
      const batchStartTime = performance.now();

      for (let i = recordCount; i < targetCount; i++) {
        const recordName = `record-${i}`;

        try {
          const recordStartTime = performance.now();
          currentMemory = await addRecord(recordName, i, currentMemory);
          const recordTime = performance.now() - recordStartTime;

          // Check for memory expansion in batch processing too
          const currentMemorySizeMB = (
            currentMemory.byteLength /
            1024 /
            1024
          ).toFixed(1);
          if (currentMemorySizeMB !== lastMemorySize) {
            const recordsSinceLastExpansion =
              i + 1 - lastMemoryChangeRecordCount;
            const expansionAmountMB = (
              parseFloat(currentMemorySizeMB) - parseFloat(lastMemorySize)
            ).toFixed(1);
            console.log(
              `    🔥 MEMORY EXPANSION: ${lastMemorySize}MB → ${currentMemorySizeMB}MB (+${expansionAmountMB}MB) after ${recordsSinceLastExpansion} records`,
            );
            lastMemorySize = currentMemorySizeMB;
            lastMemoryChangeRecordCount = i + 1;
          }

          // Log timing every 50 records within the batch
          if ((i + 1) % 50 === 0) {
            const currentBatchTime = performance.now() - batchStartTime;
            const recordsInBatch = i + 1 - recordCount;
            const avgTimePerRecord = (
              currentBatchTime / recordsInBatch
            ).toFixed(1);

            console.log(
              `    ${i + 1} records added (avg ${avgTimePerRecord}ms/record, last: ${recordTime.toFixed(1)}ms, memory: ${currentMemorySizeMB}MB)`,
            );
          }
        } catch (error) {
          console.log(`  ❌ Failed to add record at ${i}: ${error.message}`);
          addedSuccessfully = false;
          break;
        }
      }

      const totalBatchTime = performance.now() - batchStartTime;
      console.log(
        `  📊 Batch completed in ${totalBatchTime.toFixed(1)}ms (avg ${(totalBatchTime / 300).toFixed(1)}ms/record, memory: ${lastMemorySize}MB)`,
      );

      if (!addedSuccessfully) {
        console.log(
          `  ❌ Failed to add full batch, stopping at ${recordCount} records`,
        );
        break;
      }

      recordCount = targetCount;
      console.log(
        `  ✅ Successfully added batch, now at ${recordCount.toLocaleString()} records`,
      );

      // Test State call
      console.log(
        `  Testing State call with ${recordCount.toLocaleString()} records...`,
      );
      const stateStartTime = performance.now();
      const stateResult = await testStateCall(currentMemory);
      const stateTime = performance.now() - stateStartTime;

      if (stateResult.success) {
        console.log(
          `    ✅ State call successful: ${stateResult.sizeInMB} MB, ${stateResult.recordCount} records (took ${stateTime.toFixed(1)}ms)`,
        );
        lastSuccessfulCount = recordCount;
        lastSuccessfulSize = stateResult.sizeInMB;

        // Update memory if State call was successful
        if (stateResult.memory) {
          currentMemory = stateResult.memory;
        }
      } else {
        console.log(
          `    ❌ State call failed with ${recordCount.toLocaleString()} records (took ${stateTime.toFixed(1)}ms)`,
        );
        console.log(
          `\n🏁 FINAL RESULT: Maximum egress limit is ${lastSuccessfulCount.toLocaleString()} records`,
        );
        console.log(
          `📊 This corresponds to approximately ${lastSuccessfulSize} MB of JSON egress data`,
        );
        break;
      }
    }

    // Final verification
    console.log(
      `\n🔬 Final verification with ${lastSuccessfulCount.toLocaleString()} records...`,
    );
    const finalTest = await testStateCall(currentMemory);

    if (finalTest.success) {
      console.log(`✅ Final verification successful: ${finalTest.sizeInMB} MB`);
    } else {
      console.log(`❌ Final verification failed`);
    }

    // Assert that we found a reasonable limit
    assert(
      lastSuccessfulCount >= 9000,
      `Expected to handle at least 9,000 records, got ${lastSuccessfulCount}`,
    );

    console.log(`\n📋 SUMMARY:`);
    console.log(
      `  Maximum egress records: ${lastSuccessfulCount.toLocaleString()}`,
    );
    console.log(`  Maximum egress JSON size: ${lastSuccessfulSize} MB`);

    return lastSuccessfulCount;
  });
});
