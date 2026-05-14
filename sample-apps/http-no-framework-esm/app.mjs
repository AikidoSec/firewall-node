import http from "node:http";

const port = parseInt(process.argv[2], 10) || 4000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
