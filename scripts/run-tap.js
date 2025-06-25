const { execSync } = require("child_process");

const version = process.versions.node.split(".");
const major = parseInt(version[0], 10);

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

  if (major < 22) {
    console.error(
      "Error:: --test-new-instrumentation is not supported on Node.js versions below 22."
    );
    process.exit(1);
  }

  // This list excludes test files of sinks and sources that are not yet ported to the new instrumentation
  const excludedTestFilesForNewInstrumentation = [
    "**/sinks/Undici*",
    "**/sinks/SQLite3.test.ts",
    "**/sinks/Prisma.test.ts",
    "**/sinks/AwsSDK*",

    "**/sources/Lambda.test.ts",
    "**/sources/FunctionsFramework.test.ts",
    "**/sources/GraphQL.test.ts",
    "**/sources/GraphQL.schema.test.ts",
    "**/sources/GraphQL.tools.test.ts",
  ];

  for (const exclude of excludedTestFilesForNewInstrumentation) {
    args += ` --exclude='${exclude}'`;
  }
}

execSync(`tap run ${args}`, {
  stdio: "inherit",
  env: {
    ...process.env,
    AIKIDO_CI: "true",
    // In v24 some sub-dependencies are calling require on a esm module triggering an experimental warning
    NODE_OPTIONS: major === 24 ? "--disable-warning=ExperimentalWarning" : "",
  },
});
