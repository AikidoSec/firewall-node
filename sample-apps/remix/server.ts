process.env.AIKIDO_DEBUG = "true";
process.env.AIKIDO_BLOCK = "true";
process.env.AIKIDO_TOKEN =
  "AIK_RUNTIME_135_8093_wYYGtGOdwnMSQTL1T6et6LTeGIPep5Qwqfb2USY35e8LLI7f";

const Zen = await import("@aikidosec/firewall");

import { createRequestHandler } from "@remix-run/express";
import express from "express";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

Zen.addExpressMiddleware(app);

app.use(
  viteDevServer ? viteDevServer.middlewares : express.static("build/client")
);

const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");

app.all("*", createRequestHandler({ build }));

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
