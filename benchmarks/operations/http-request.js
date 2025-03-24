const http = require("http");

module.exports = {
  step: async function step() {
    return new Promise((resolve, reject) => {
      const req = http.request("http://localhost:10411", (res) => {
        res.resume();
        res.on("end", resolve);
      });

      req.on("error", reject);
      req.end();
    });
  },
};
