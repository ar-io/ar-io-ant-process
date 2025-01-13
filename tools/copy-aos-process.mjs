import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rm, rename, copyFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const configContent = fs.readFileSync(
  path.join(__dirname, '../ao-build-config.yml'),
  'utf-8',
);

const config = yaml.load(configContent);

const repoUrl = 'https://github.com/permaweb/aos.git';
const commitHash = config.aos_git_hash;
const tempRepoDir = path.resolve('temp-repo');
const processTargetDir = path.resolve('tools/fixtures/aos-process');
const configSourceFile = path.resolve('ao-build-config.yml');
const configDestFile = path.join(processTargetDir, 'config.yml');

async function copyAosProcess() {
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
    const processDir = path.join(tempRepoDir, 'process');
    console.log(`Moving ${processDir} to ${processTargetDir}`);
    await rename(processDir, processTargetDir);

    // Step 5: Remove the temporary repository
    console.log(`Removing temporary directory: ${tempRepoDir}`);
    await rm(tempRepoDir, { recursive: true, force: true });

    // Step 6: Copy the build config file to the target directory
    console.log(`Copying ${configSourceFile} to ${configDestFile}`);
    await copyFile(configSourceFile, configDestFile);

    console.log('Successfully copied aos process and config.');
  } catch (error) {
    console.error('Error during copy-aos-process:', error);
    process.exit(1);
  }
}

copyAosProcess();
