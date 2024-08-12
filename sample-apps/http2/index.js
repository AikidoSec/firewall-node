require("@aikidosec/firewall");

const http2 = require("http2");
const { readFile } = require("fs/promises");
const { join } = require("path");

async function main() {
  const key = await readFile(join(__dirname, "key.pem"));
  const cert = await readFile(join(__dirname, "cert.pem"));
  const server = http2.createSecureServer({ key, cert });

  server.on("stream", (stream, headers) => {
    const method = headers[":method"];

    if (method !== "POST") {
      stream.respond({
        ":status": 405,
      });
      stream.end("Method Not Allowed");
      return;
    }

    let rawBody = "";
    stream.on("data", (chunk) => {
      rawBody += chunk;
    });

    stream.on("end", () => {
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch (error) {
        stream.respond({
          ":status": 400,
        });
        stream.end("Invalid JSON");
        return;
      }

      if (!body.url) {
        stream.respond({
          ":status": 400,
        });
        stream.end("Missing URL in request body");
        return;
      }

      fetch(body.url)
        .then((response) => response.arrayBuffer())
        .then((data) => {
          stream.respond({
            "content-type": "image/jpeg",
            ":status": 200,
          });
          stream.end(Buffer.from(data));
        })
        .catch((error) => {
          stream.respond({
            ":status": 500,
          });
          stream.end(error);
        });
    });
  });

  const port = getPort();
  server.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
