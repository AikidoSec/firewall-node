const { execSync } = require("child_process");

// Command to run
const command = "tap tests/*.js --allow-empty-coverage -j 1";

execSync(command, {
  stdio: "inherit",
  env: { ...process.env, AIKIDO_CI: "true" },
});
