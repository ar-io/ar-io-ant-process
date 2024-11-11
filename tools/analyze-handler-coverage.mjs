import fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';
import luaparse from 'luaparse';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Configure named arguments
const argv = yargs(hideBin(process.argv))
  .option('luaEntryFile', {
    alias: 'l',
    type: 'string',
    description: 'Path to the Lua entry file',
    demandOption: true,
  })
  .option('testFilePattern', {
    alias: 't',
    type: 'string',
    description: 'Glob pattern for test files (e.g., **/*.test.(ts|mjs|js))',
    demandOption: true,
  })
  .option('coverageOutputFile', {
    alias: 'o',
    type: 'string',
    description: 'File to output the coverage report (optional)',
  })
  .help().argv;

// Handler extraction functions
function getHandlerNames(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = luaparse.parse(content);
  const handlers = new Set();

  function traverseNode(node) {
    if (
      node.type === 'FunctionDeclaration' &&
      node.identifier.identifier.name == 'init'
    ) {
      node.body.forEach((subNode) => {
        if (
          subNode.type == 'LocalStatement' &&
          subNode.variables[0].name.includes('ActionMap')
        ) {
          subNode.init?.forEach((initNode) => {
            if (initNode.type === 'TableConstructorExpression') {
              initNode.fields.forEach((field) => {
                if (
                  field.key.type === 'Identifier' &&
                  field.value.type === 'StringLiteral'
                ) {
                  handlers.add(field.value.raw.replace(/^["']|["']$/g, '')); // Remove quotes
                }
              });
            }
          });
        }
      });
    }
  }

  ast.body.forEach((node) => traverseNode(node));
  return Array.from(handlers);
}

// Test file processing functions
function extractTestedHandlers(testFileContent) {
  const actionRegex = /{ name: 'Action', value: ['"](\w+(-\w+)?)['"] }/g;
  const testedHandlers = new Set();
  let match;

  while ((match = actionRegex.exec(testFileContent)) !== null) {
    // Add handler to set, ensuring any quotes are removed
    testedHandlers.add(match[1].replace(/^['"]|['"]$/g, ''));
  }

  return [...testedHandlers];
}

function getTestedHandlersInFiles(pattern, luaHandlers) {
  const testedHandlers = new Set();
  const files = glob.sync(pattern, {});
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    extractTestedHandlers(content, luaHandlers).forEach((handler) =>
      testedHandlers.add(handler),
    );
  });
  return [...testedHandlers];
}

// Coverage report generation
function generateCoverageReport(luaHandlers, testedHandlers) {
  const untestedHandlers = luaHandlers.filter(
    (handler) => !testedHandlers.includes(handler),
  );
  const coverage =
    ((luaHandlers.length - untestedHandlers.length) / luaHandlers.length) * 100;
  const reportLines = [];

  reportLines.push(chalk.bold('\nHandlers Coverage Report'));
  reportLines.push(`Total Handlers: ${chalk.cyan(luaHandlers.length)}`);
  reportLines.push(
    `Tested Handlers: ${chalk.green(luaHandlers.length - untestedHandlers.length)}`,
  );
  reportLines.push(`Untested Handlers: ${chalk.red(untestedHandlers.length)}`);
  reportLines.push(
    `Coverage: ${coverage >= 80 ? chalk.green.bold(coverage.toFixed(2) + '%') : chalk.red.bold(coverage.toFixed(2) + '%')}`,
  );

  if (untestedHandlers.length > 0) {
    reportLines.push(chalk.bold.red('\nUntested Handlers:'));
    untestedHandlers.forEach((handler) =>
      reportLines.push(`- ${chalk.red(handler)}`),
    );
  } else {
    reportLines.push(chalk.bold.green('\nAll handlers are tested!'));
  }

  const reportText = reportLines.join('\n');
  console.log(reportText);

  if (argv.coverageOutputFile) {
    fs.writeFileSync(
      argv.coverageOutputFile,
      reportLines.join('\n').replace(/\x1b\[[0-9;]*m/g, ''),
    );
    console.log(chalk.green(`\nReport written to ${argv.coverageOutputFile}`));
  }
}

// Run the report generation
const luaHandlers = getHandlerNames(argv.luaEntryFile);
const testedHandlers = getTestedHandlersInFiles(
  argv.testFilePattern,
  luaHandlers,
);
generateCoverageReport(luaHandlers, testedHandlers);
