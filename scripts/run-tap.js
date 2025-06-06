const { execSync } = require("child_process");

const version = process.versions.node.split(".");
const major = parseInt(version[0], 10);
const minor = parseInt(version[1], 10);

let args = "--allow-incomplete-coverage";

// If script is called with arg --ci, set env CI to true
if (process.argv.includes("--ci")) {
  process.env.CI = "true";
}

if (process.env.CI) {
  args += " --coverage-report=lcov";
}

if (process.argv.includes("--test-new-instrumentation")) {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
}

execSync(`tap ${args}`, {
  stdio: "inherit",
  env: {
    ...process.env,
    AIKIDO_CI: "true",
    // In v23 some sub-dependencies are calling require on a esm module triggering an experimental warning
    NODE_OPTIONS: major === 24 ? "--disable-warning=ExperimentalWarning" : "",
  },
});
