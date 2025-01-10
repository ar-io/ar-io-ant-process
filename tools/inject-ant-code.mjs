import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths for process.lua, aos-bundled.lua source, and destination
const processFilePath = path.join(__dirname, '../aos-process', 'process.lua');
const bundleSourcePath = path.join(__dirname, '../dist', 'aos-bundled.lua');
const bundleDestPath = path.join(
  __dirname,
  '../aos-process',
  'aos-bundled.lua',
);

// Copy the aos-bundled.lua file
fs.copyFileSync(bundleSourcePath, bundleDestPath);
console.log('Copied aos-bundled.lua to aos-process directory.');

// Read the content of process.lua
let processFileContent = fs.readFileSync(processFilePath, 'utf-8');

// Match all occurrences of Handlers.append
const handlersAppendRegex = /(Handlers\.append.*)/g;

// Find the last occurrence of Handlers.append
let lastMatch;
let match;
while ((match = handlersAppendRegex.exec(processFileContent)) !== null) {
  lastMatch = match;
}

// Inject the require line after the last Handlers.append
if (lastMatch && !processFileContent.includes("require('.aos-bundled')")) {
  const position = lastMatch.index + lastMatch[0].length;
  processFileContent =
    processFileContent.slice(0, position) +
    "\nrequire('.aos-bundled')" +
    processFileContent.slice(position);

  // Write the updated content back to the file
  fs.writeFileSync(processFilePath, processFileContent);
  console.log(
    "Injected require('.aos-bundled') after the last Handlers.append.",
  );
} else if (!lastMatch) {
  console.log('No Handlers.append found in process.lua.');
} else {
  console.log("The require('.aos-bundled') line is already present.");
}
