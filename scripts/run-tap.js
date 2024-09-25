const { execSync } = require("child_process");

const version = process.versions.node.split(".");
const major = parseInt(version[0], 10);
const minor = parseInt(version[1], 10);

// If script is called with arg --ci, set env CI to true
if (process.argv.includes("--ci")) {
  process.env.CI = "true";
}

let args = "--allow-incomplete-coverage";

if (process.env.CI) {
  args += " --coverage-report=lcov";
}

// Enable the `--experimental-sqlite` flag for Node.js ^22.5.0
if (major === 22 && minor >= 5) {
  args += " --node-arg=--experimental-sqlite --node-arg=--no-warnings";
}

execSync(`tap ${args}`, {
  stdio: "inherit",
  env: { ...process.env, AIKIDO_CI: "true" },
});
