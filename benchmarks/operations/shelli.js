const { execSync } = require("child_process");

module.exports = {
  step: async function step() {
    execSync("ls -la");
  },
};
