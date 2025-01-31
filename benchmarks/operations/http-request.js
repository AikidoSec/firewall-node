const http = require("http");

module.exports = {
  step: async function step() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "localhost",
        port: 10411,
      };

      const req = http.request(options, (res) => {
        res.on("data", () => {});
        res.on("end", resolve);
      });

      req.on("error", reject);
      req.end();
    });
  },
};
