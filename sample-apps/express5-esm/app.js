import Zen from "@aikidosec/firewall";
import express from "express";
import http from "node:http";
import https from "node:https";

import "@aikidosec/firewall/nopp";

const app = express();

Zen.addExpressMiddleware(app);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.get("/fetch", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing 'url' parameter");
  }

  const response = await fetch(url);
  res.json({ method: "fetch", status: response.status });
});

app.get("/http-request", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send("Missing 'url' parameter");
  }

  const statusCode = await new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(url, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
      .on("error", reject);
  });
  res.json({ method: "http.request", status: statusCode });
});

const port = parseInt(process.argv[2], 10) || 4000;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
