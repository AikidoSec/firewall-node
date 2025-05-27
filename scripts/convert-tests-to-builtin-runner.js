const fs = require("fs");
const path = require("path");
const jscodeshift = require("jscodeshift");
const ts = require("typescript"); // Import typescript
const transform = require("./tap-to-node-test-transform"); // Your transform script

const libraryDir = path.join(__dirname, "../library");
const ignoreDir = path.join(libraryDir, "node_modules");

function findTestFilesRecursive(dir, allTestFiles = []) {
  // Check if the current directory is the one to ignore
  if (path.resolve(dir) === path.resolve(ignoreDir)) {
    return allTestFiles;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTestFilesRecursive(fullPath, allTestFiles);
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      allTestFiles.push(fullPath);
    }
  }
  return allTestFiles;
}

const testFilePaths = findTestFilesRecursive(libraryDir);
const testFilesData = [];

if (testFilePaths.length === 0) {
  console.log(
    `No .test.ts files found in ${libraryDir} or its subdirectories (excluding ${ignoreDir})`
  );
} else {
  testFilePaths.forEach((filePath) => {
    try {
      const fileSource = fs.readFileSync(filePath, "utf8");
      const fileInfo = {
        path: filePath,
        source: fileSource,
      };

      // Get a jscodeshift API instance configured to parse TypeScript
      // This 'j' object will be passed to your transform as 'api.jscodeshift'
      const j = jscodeshift.withParser("ts");

      const api = {
        jscodeshift: j,
        stats: () => {}, // No-op stats function for the transform
        options: {}, // Options for the transform, if any are defined in it
      };

      const structurallyTransformedContent = transform(
        fileInfo,
        api,
        api.options
      );

      let finalContent = "// Error: Transform did not return a string";
      if (typeof structurallyTransformedContent === "string") {
        // Now, transpile the structurally transformed TS code to JS using TypeScript API
        const transpileOutput = ts.transpileModule(
          structurallyTransformedContent,
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS, // Output CommonJS modules
              target: ts.ScriptTarget.ES2020, // Target ES2020 (Node 16 supports this well)
              esModuleInterop: true, // For better compatibility with CommonJS modules
              // removeComments: false, // Keep comments, including the TODO for t.match
              // You can add other options if needed, e.g., downlevelIteration
            },
          }
        );
        finalContent = transpileOutput.outputText;
        testFilesData.push({ path: filePath, content: finalContent.trim() });
      } else {
        console.warn(
          `Transform for ${filePath} did not return a string. Storing original content (untranspiled).`
        );
        // Still use the original path for the data structure, but note it's untransformed
        testFilesData.push({ path: filePath, content: fileSource }); // Store original if transform failed
      }
    } catch (error) {
      console.error(
        `Error transforming file ${filePath} programmatically:`,
        error.message,
        error.stack
      );
      testFilesData.push({
        path: filePath,
        content: `// Error during programmatic transform: ${error.message}`,
      });
    }
  });
}

// Write transformed files to disk
// Process only the first 5 files
const filesToWrite = testFilesData.slice(0, 5);

filesToWrite.forEach((fileData) => {
  const originalPath = fileData.path;
  const newPath = originalPath.replace(/\.ts$/, ".js"); // Change extension to .js in the original path

  try {
    fs.writeFileSync(newPath, fileData.content, "utf8");
    console.log(`Successfully wrote transformed file to ${newPath}`);
  } catch (error) {
    console.error(`Error writing file ${newPath}:`, error.message);
  }
});
