const { exec } = require("child_process");

module.exports = {
  step: async function step() {
    return new Promise((resolve, reject) => {
      exec("echo", { cwd: __dirname }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },
};
