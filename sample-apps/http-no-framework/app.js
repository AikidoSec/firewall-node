require("@aikidosec/firewall");

const http = require("http");

if (process.env.LOAD_FRAMEWORK) {
  require("express");
}

const port = parseInt(process.argv[2], 10) || 4000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
