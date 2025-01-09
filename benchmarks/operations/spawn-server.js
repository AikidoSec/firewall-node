const { createServer } = require("http");

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello Node.js!");
});

server.listen(10411);

process.on("SIGTERM", () => {
  server.close(() => {
    process.exit(0);
  });
});
