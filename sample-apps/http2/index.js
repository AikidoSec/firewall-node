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

    if (method !== "GET") {
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

    stream.on("end", async () => {
      const requestUrl = new URL(
        headers[":path"],
        headers[":scheme"] + "://" + headers[":authority"]
      );

      const url = requestUrl.searchParams.get("url");

      if (typeof url !== "string") {
        stream.respond({
          ":status": 400,
        });
        stream.end("Missing URL in request query");
        return;
      }

      try {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        stream.respond({
          "content-type": "image/jpeg",
          ":status": 200,
        });
        stream.end(Buffer.from(data));
      } catch (error) {
        console.error(error.message);
        stream.respond({
          ":status": 500,
        });
        stream.end(error.message);
      }
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
