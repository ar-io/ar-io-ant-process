// test-runner.js
const { spawn } = require('node:child_process');
const path = require('node:path');
const glob = require('fast-glob');
const { pLimit } = require('plimit-lit');
const chalk = require('chalk'); // Import chalk for colorizing output
const { getPublishedSourceCodeIds } = require('./utils'); // Import the function for getting source IDs

// Define the concurrency limit for test runs using `plimit-lit`
const limit = pLimit(5);

// Define the pattern to match all .test.js files in the current directory and subdirectories
const testPattern = path.resolve(__dirname, '**/*.test.js');

// Use `fast-glob` to find all matching test files
const testFiles = glob.sync(testPattern);

// Check if any test files were found
if (testFiles.length === 0) {
  console.error('No test files found. Aborting test run.');
  process.exit(1);
}

// Retrieve the source code IDs using the previously defined function
const luaSourceIds = getPublishedSourceCodeIds();

// Check if any source code IDs were found
if (luaSourceIds.length === 0) {
  console.error('No Lua Source IDs found. Aborting test run.');
  process.exit(1);
}

// Store results for final reporting
const testResults = {
  successes: [],
  failures: [],
};

// Function to spawn a test process for a given `luaSourceId`
const runTestForSourceId = (luaSourceId) => {
  return new Promise((resolve, reject) => {
    console.log(`Running tests for Lua Source ID: ${luaSourceId}`);

    // Spawn a new Node.js process using `node --test` with the collected test files and `luaSourceId`
    const testProcess = spawn(
      'node',
      [
        '--test',
        '--test-concurrency',
        '1',
        '--experimental-wasm-memory64',
        ...testFiles,
      ],
      {
        stdio: 'inherit', // Inherit stdio to show real-time test output
        env: { ...process.env, luaSourceId }, // Pass `luaSourceId` to the environment variables
      },
    );

    // Handle process completion
    testProcess.on('close', (code) => {
      if (code !== 0) {
        const errorMessage = `Tests failed for Lua Source ID: ${luaSourceId} with exit code: ${code}`;
        console.error(errorMessage);
        testResults.failures.push({
          luaSourceId,
          message: errorMessage,
        });
        reject(new Error(errorMessage));
      } else {
        const successMessage = `Tests completed successfully for Lua Source ID: ${luaSourceId}`;
        console.log(successMessage);
        testResults.successes.push({
          luaSourceId,
          message: successMessage,
        });
        resolve();
      }
    });
  });
};

// Create and execute test tasks with the concurrency limit
const testTasks = luaSourceIds.map((sourceId) =>
  limit(() => runTestForSourceId(sourceId)),
);

Promise.allSettled(testTasks)
  .then((results) => {
    // Generate the summary report
    console.log('\nTest Summary:');
    console.log('---------------');

    // Display successful tests in green
    if (testResults.successes.length > 0) {
      console.log(chalk.green('\nSuccessful Tests:'));
      testResults.successes.forEach((result, index) => {
        console.log(chalk.green(`${index + 1}. ${result.message}`));
      });
    }

    // Display failed tests in red
    if (testResults.failures.length > 0) {
      console.error(chalk.red('\nFailed Tests:'));
      testResults.failures.forEach((result, index) => {
        console.error(chalk.red(`${index + 1}. ${result.message}`));
      });
      console.error(
        chalk.red(`\n${testResults.failures.length} test(s) failed.`),
      );
      process.exit(1); // Exit with a non-zero code for failed tests
    } else {
      console.log(chalk.green('\nAll tests completed successfully.'));
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('Unexpected error occurred:', error);
    process.exit(1);
  });
