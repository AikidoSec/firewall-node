require("@aikidosec/firewall");

const http = require("http");

// This app generates code from a string while starting up. With
// --disallow-code-generation-from-strings, Node blocks this and the app crashes.
// Zen uses the same V8 hook, so it must not re-enable code generation here.
const sum = new Function("return 1 + 1")();
console.log(`Code generation works, 1 + 1 = ${sum}`);

const port = parseInt(process.argv[2], 10) || 4000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
