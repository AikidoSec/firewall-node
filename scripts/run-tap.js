const { execSync } = require("child_process");

const version = process.versions.node.split(".");
const major = parseInt(version[0], 10);
const minor = parseInt(version[1], 10);

let args = "--allow-incomplete-coverage --jobs=8";

if (process.env.CI) {
  args += " --coverage-report=lcov";
}

// Enable the `--experimental-sqlite` flag for Node.js ^22.5.0
if ((major === 22 && minor >= 5) || major === 23) {
  args += " --node-arg=--experimental-sqlite --node-arg=--no-warnings";
}

execSync(`tap ${args}`, {
  stdio: "inherit",
  env: {
    ...process.env,
    AIKIDO_CI: "true",
    // In v23 some sub-dependencies are calling require on a esm module triggering an experimental warning
    NODE_OPTIONS: major === 23 ? "--disable-warning=ExperimentalWarning" : "",
  },
});
