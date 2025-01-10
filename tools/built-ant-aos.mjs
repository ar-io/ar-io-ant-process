import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid'; // Use UUID for unique folder names
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createBuild = () => {
  // Generate a unique folder name using UUID
  const tempBuildFolderName = `temp-build-${uuidv4()}`;
  const tempBuildPath = path.join(__dirname, tempBuildFolderName);

  // Define paths
  const aosProcessPath = path.join(__dirname, 'aos-process');
  const srcFolderPath = path.join(__dirname, 'src');
  const distPath = path.join(__dirname, 'dist');
  const wasmSourcePath = path.join(aosProcessPath, 'process.wasm');
  const wasmDestPath = path.join(distPath, 'aos-ant.wasm');
  const processLuaPath = path.join(tempBuildPath, 'process.lua');

  try {
    // Step 1: Create a temp build folder
    fs.mkdirSync(tempBuildPath);
    console.log(`Created temp build folder: ${tempBuildFolderName}`);

    // Step 2: Copy aos-process folder to temp build folder
    fs.cpSync(aosProcessPath, tempBuildPath, { recursive: true });
    console.log('Copied aos-process to temp build folder.');

    // Step 3: Copy the folder structure of the ant code (src folder)
    const antFolderPath = path.join(tempBuildPath, 'ant');
    fs.mkdirSync(antFolderPath);
    fs.cpSync(srcFolderPath, antFolderPath, { recursive: true });
    console.log('Copied src folder to ant in temp build folder.');

    // Step 4: Inject `require('.ant.aos').init()` into process.lua
    let processFileContent = fs.readFileSync(processLuaPath, 'utf-8');
    if (!processFileContent.includes("require('.ant.aos').init()")) {
      const handlersAddRegex = /(Handlers\.append.*)/g;
      let lastMatch;
      let match;
      while ((match = handlersAddRegex.exec(processFileContent)) !== null) {
        lastMatch = match;
      }
      if (lastMatch) {
        const position = lastMatch.index + lastMatch[0].length;
        processFileContent =
          processFileContent.slice(0, position) +
          "\nrequire('.ant.aos').init()" +
          processFileContent.slice(position);
        fs.writeFileSync(processLuaPath, processFileContent);
        console.log("Injected require('.ant.aos').init() into process.lua.");
      } else {
        console.log(
          'No Handlers.append found in process.lua. Skipping injection.',
        );
      }
    } else {
      console.log("The require('.ant.aos').init() line is already present.");
    }

    // Step 5: Move process.wasm to dist folder and rename to aos-ant.wasm
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath);
    }
    fs.renameSync(wasmSourcePath, wasmDestPath);
    console.log(
      'Moved process.wasm to dist folder and renamed to aos-ant.wasm.',
    );
  } catch (error) {
    console.error('Error during build process:', error);
  } finally {
    // Cleanup: Remove temp build folder
    if (fs.existsSync(tempBuildPath)) {
      fs.rmSync(tempBuildPath, { recursive: true });
      console.log(`Cleaned up temp build folder: ${tempBuildFolderName}`);
    }
  }
};

// Run the build function
createBuild();
