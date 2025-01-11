import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../build', 'process.lua');

let fileContent = fs.readFileSync(filePath, 'utf-8');

// List of require statements to remove
// these are unused in the current AOS version, and crypto specifically blow up memory on load
// we remove these unused imports to prevent that from happening.
const requiresToDelete = [
  "local pretty = require('.pretty')",
  "local base64 = require('.base64')",
  "local json = require('json')",
  "local crypto = require('.crypto.init')",
];

requiresToDelete.forEach((requireStatement) => {
  const requireRegex = new RegExp(
    `^\\s*${requireStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};?\\n?`,
    'gm',
  );
  fileContent = fileContent.replace(requireRegex, '');
});

console.log(
  `Removed specific require statements: ${requiresToDelete.join(', ')}`,
);

const handlersAppendRegex = /(Handlers\.append.*)/g;

// Find the last occurrence of Handlers.append
let lastMatch;
let match;
while ((match = handlersAppendRegex.exec(fileContent)) !== null) {
  lastMatch = match;
}

// Inject the require line after the last Handlers.append
if (lastMatch && !fileContent.includes("require('.ant')")) {
  const position = lastMatch.index + lastMatch[0].length;
  fileContent =
    fileContent.slice(0, position) +
    "\nrequire('.ant');" +
    fileContent.slice(position);

  console.log("Injected require('.ant') after the last Handlers.append.");
} else if (!lastMatch) {
  console.log('No Handlers.append found in process.lua.');
} else {
  console.log("The require('.ant') line is already present.");
}

// Write the updated content back to the file
fs.writeFileSync(filePath, fileContent);
