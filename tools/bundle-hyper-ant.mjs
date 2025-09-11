import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rm, rename, cp } from 'node:fs/promises';
import { bundle } from './lua-bundler.mjs';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configContent = fs.readFileSync(
  path.join(__dirname, '../ao-hyper-build-config.yml'),
  'utf-8',
);

const config = yaml.load(configContent);

const repoUrl = 'https://github.com/permaweb/aos.git';
const commitHash = config.aos_git_hash;
const tempRepoDir = path.resolve('temp-repo');
const processTargetDir = path.resolve('tools/fixtures/hyper-aos');

////////////////////////////////////////////////////////////
// begin copy aos hyper process
////////////////////////////////////////////////////////////
try {
  // Step 1: Remove existing `aos-process` directory
  console.log(`Removing existing directory: ${processTargetDir}`);
  await rm(processTargetDir, { recursive: true, force: true });

  // Step 2: Clone the repository into a temporary directory
  console.log(`Cloning repository: ${repoUrl}`);
  await execAsync(`git clone ${repoUrl} ${tempRepoDir}`);

  // Step 3: Checkout the specific commit hash
  console.log(`Checking out commit: ${commitHash}`);
  await execAsync(`git checkout ${commitHash}`, { cwd: tempRepoDir });

  // Step 4: Move the `process` directory to the target location
  const processDir = path.join(tempRepoDir, 'hyper');
  console.log(`Moving ${processDir} to ${processTargetDir}`);
  await rename(processDir, processTargetDir);

  // Step 5: Remove the temporary repository
  console.log(`Removing temporary directory: ${tempRepoDir}`);
  await rm(tempRepoDir, { recursive: true, force: true });

  console.log('Successfully copied aos hyper process.');
} catch (error) {
  console.error('Error during copy-aos-hyper-process:', error);
  process.exit(1);
}

////////////////////////////////////////////////////////////
// begin inject ant code
////////////////////////////////////////////////////////////

// copy hyper process to build directory
await cp(processTargetDir, path.join(__dirname, '../build', 'hyper-aos'), {
  recursive: true,
});
// copy bundled ant to build directory
fs.copyFileSync(
  path.join(__dirname, '../dist', 'aos-bundled.lua'),
  path.join(__dirname, '../build/hyper-aos/src', 'ant.lua'),
);

const filePath = path.join(
  __dirname,
  '../build',
  'hyper-aos',
  'src',
  'process.lua',
);

let fileContent = fs.readFileSync(filePath, 'utf-8');

const handlersRemoveRegex = /(Handlers\.remove.*)/g;

// Find the last occurrence of Handlers.remove
let lastMatch;
let match;
while ((match = handlersRemoveRegex.exec(fileContent)) !== null) {
  lastMatch = match;
}

// Inject the require line after the last Handlers.remove
if (lastMatch && !fileContent.includes("require('.ant')")) {
  const position = lastMatch.index + lastMatch[0].length;
  fileContent =
    fileContent.slice(0, position) +
    "\nrequire('.ant');" +
    fileContent.slice(position);

  console.log("Injected require('.ant') after the last Handlers.remove.");
} else if (!lastMatch) {
  console.log('No Handlers.append found in process.lua.');
} else {
  console.log("The require('.ant') line is already present.");
}

////////////////////////////////////////////////////////////
// begin bundle hyper-ant
////////////////////////////////////////////////////////////

// Write the updated content back to the file
fs.writeFileSync(filePath, fileContent);

console.log('Bundling Lua...');

const bundledLua = bundle(
  path.join(__dirname, '../build/hyper-aos/src/main.lua'),
);

if (!fs.existsSync(path.join(__dirname, '../dist'))) {
  fs.mkdirSync(path.join(__dirname, '../dist'));
}

fs.writeFileSync(
  path.join(__dirname, '../dist/hyper-ant-bundled.lua'),
  bundledLua,
);
console.log('Doth Hyper-Ant Lua hath been bundled!');

// remove the build directory
await rm(path.join(__dirname, '../build'), { recursive: true, force: true });

console.log('Successfully bundled hyper-aos.');
