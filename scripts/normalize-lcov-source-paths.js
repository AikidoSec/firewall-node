const { readFileSync, writeFileSync } = require("node:fs");

const [inputPath, outputPath] = process.argv.slice(2);
const content = readFileSync(inputPath, "utf8");

writeFileSync(outputPath, content.replace(/^SF:(?:\.\.\/)+/gm, "SF:"));
