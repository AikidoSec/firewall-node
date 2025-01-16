const http = require("http");

module.exports = {
  step: async function step() {
    const req = http.request("http://localhost:10411", (res) => {
      res.resume();
    });

    req.end();
  },
};
