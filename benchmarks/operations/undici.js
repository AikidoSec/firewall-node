const undici = require("undici");

module.exports = {
  step: async function step() {
    return await undici.request("http://localhost:10411");
  },
};
