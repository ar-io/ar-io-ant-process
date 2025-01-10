import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../build', 'process.lua');

// Read the file
let fileContent = fs.readFileSync(filePath, 'utf-8');

// Match all occurrences of Handlers.append
const handlersAppendRegex = /(Handlers\.append.*)/g;

// Find the last occurrence of Handlers.append
let lastMatch;
let match;
while ((match = handlersAppendRegex.exec(fileContent)) !== null) {
  lastMatch = match;
}

// Inject the require line after the last Handlers.append
if (lastMatch && !fileContent.includes("require('.common.main').init()")) {
  const position = lastMatch.index + lastMatch[0].length;
  fileContent =
    fileContent.slice(0, position) +
    "\nrequire('.common.main').init();" +
    fileContent.slice(position);

  // Write the updated content back to the file
  fs.writeFileSync(filePath, fileContent);
  console.log(
    "Injected  require('.common.main').init() after the last Handlers.append.",
  );
} else if (!lastMatch) {
  console.log('No Handlers.append found in process.lua.');
} else {
  console.log("The require('.common.main').init() line is already present.");
}
