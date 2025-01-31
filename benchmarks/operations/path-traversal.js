const { readFile } = require("fs/promises");

module.exports = {
  step: async function step() {
    await readFile("./package.json");
  },
};
