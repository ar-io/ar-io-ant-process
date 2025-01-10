import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../aos-process', 'process.lua');

// Read the file
let fileContent = fs.readFileSync(filePath, 'utf-8');

// Match the `process.handle` function and its body
const processHandleRegex = /(function process\.handle[^\n]*\n)/;

// Replace the top of the function with the required line
fileContent = fileContent.replace(processHandleRegex, (match) => {
  const insertion = "    require('.ant').init()\n";
  return match + insertion;
});

// Write the updated content back to the file
fs.writeFileSync(filePath, fileContent);

console.log("Injected require('.ant').init() at the top of process.handle.");
