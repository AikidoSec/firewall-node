const { writeFile } = require("fs/promises");
const { join } = require("path");

async function main() {
  const pkg = require(join(__dirname, "../library/package.json"));

  // We're going to remove the devDependencies from the package.json
  // Otherwise they will show up in every lock file
  // whenever we add a new dev dependency to the library
  delete pkg.devDependencies;

  await writeFile(
    join(__dirname, "../build/package.json"),
    JSON.stringify(pkg, null, 2)
  );
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
  }
})();
