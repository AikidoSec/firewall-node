const { createServer, get } = require("http");

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello Node.js!");
});

module.exports = {
  setup: async function setup() {
    return new Promise((resolve) => {
      server.listen(0, resolve);
    });
  },
  step: async function step() {
    return new Promise((resolve) => {
      get(`http://localhost:${server.address().port}`, (res) => {
        res.resume();
        res.on("end", resolve);
      });
    });
  },
  teardown: async function teardown() {
    server.close();
  },
};
