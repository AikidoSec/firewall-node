import { equal } from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { json } from "node:stream/consumers";
import { test } from "node:test";

test("Serves configured responses", { timeout: 10_000 }, async (t) => {
  const headers = { "X-Fixture": "configured" };
  const expectedHeaders = {
    "X-Fixture": "configured",
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };
  const body = "Sidequest fixture";
  const appBody = "App fixture";
  const bypassedIP = "1.2.3.4";
  const config = {
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/restricted/fixture",
        allowedIPAddresses: ["1.2.3.6"],
        forceProtectionOff: false,
        rateLimiting: { enabled: false },
      },
    ],
    allowedIPAddresses: [bypassedIP],
    sidequest: {
      enabled: true,
      rules: [
        { match: { pathSuffix: "/fixture" }, response: { body, headers } },
        {
          match: { pathSuffix: "/old/fixture" },
          response: { body: "Other fixture" },
        },
      ],
    },
  };
  const runtime = createServer(async (req, res) => {
    if (req.url === "/api/runtime/events") {
      const event = await json(req);
      res.end(JSON.stringify(config));
      if (event.type === "heartbeat") {
        runtime.emit("heartbeat", event);
      }
    } else if (req.url === "/api/runtime/firewall/lists") {
      res.end("{}");
      runtime.emit("config-applied");
    } else {
      res.writeHead(404).end();
    }
  });
  t.after(() => runtime.close());
  await once(runtime.listen(0, "127.0.0.1"), "listening");

  const endpoint = `http://127.0.0.1:${runtime.address().port}`;
  const app = fork(new URL("./fixtures/sidequest-app.mjs", import.meta.url), {
    cwd: resolve(
      import.meta.dirname,
      "../../sample-apps/http-no-framework-esm"
    ),
    execArgv: ["--require", "@aikidosec/firewall/instrument"],
    env: {
      ...process.env,
      AIKIDO_TOKEN: "fixture-token",
      AIKIDO_ENDPOINT: endpoint,
      AIKIDO_REALTIME_ENDPOINT: endpoint,
    },
  });
  t.after(() => app.kill());
  const [[port]] = await Promise.all([
    once(app, "message", { signal: t.signal }),
    once(runtime, "config-applied", { signal: t.signal }),
  ]);

  for (const [method, path, status, text, ip = "1.2.3.5"] of [
    ["GET", "/old/fixture?download=1", 200, body],
    ["HEAD", "/old/fixture", 200, ""],
    ["GET", "/old/Fixture?path=/fixture", 201, appBody],
    ["POST", "/old/fixture", 201, appBody],
    ["GET", "/old/fixture", 201, appBody, bypassedIP],
    ["GET", "/restricted/fixture", 403],
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "x-forwarded-for": ip },
      signal: t.signal,
    });
    const label = `${method} ${path} from ${ip}`;
    equal(response.status, status, label);
    const actualBody = await response.text();
    if (text !== undefined) {
      equal(actualBody, text, label);
    }
    if (status === 200) {
      equal(response.headers.get("x-app-handler"), null, label);
      for (const [name, value] of Object.entries(expectedHeaders)) {
        equal(response.headers.get(name), value, label);
      }
    }
  }

  const heartbeat = once(runtime, "heartbeat", { signal: t.signal });
  app.send("shutdown");
  const [event] = await heartbeat;
  equal(event.stats.requests.total, 2);
  equal(event.routes.length, 2);
});
