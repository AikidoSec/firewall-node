require("@aikidosec/firewall");

const { createServer } = require("https");
const { readFileSync } = require("fs");
const { join } = require("path");
const express = require("express");
const asyncHandler = require("express-async-handler");
const morgan = require("morgan");

require("@aikidosec/firewall/nopp");

async function main() {
  const app = express();

  app.use(morgan("tiny"));

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      res.send("Hello, world!");
    })
  );

  app.get(
    "/request",
    asyncHandler(async (req, res) => {
      const url = req.query["url"];
      if (!url) {
        return res.status(400).send("Missing 'url' parameter");
      }

      const response = await fetch(url);

      res.send({
        status: response.status,
      });
    })
  );

  // Listen on 80 and 443, use ./cert.pem and ./key.pem for SSL
  return await Promise.all([
    new Promise((resolve, reject) => {
      try {
        app.listen(80, () => {
          console.log("Listening on port 80");
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    }),
    new Promise((resolve, reject) => {
      try {
        createServer(
          {
            key: readFileSync(join(__dirname, "key.pem")),
            cert: readFileSync(join(__dirname, "cert.pem")),
          },
          app
        ).listen(443, () => {
          console.log("Listening on port 443");
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    }),
  ]);
}

main().catch(console.error);
