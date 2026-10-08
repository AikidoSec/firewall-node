# Bypass Zen for a specific request

Call `Zen.bypassRequest()` in a middleware or request handler to bypass Zen for this request. A bypassed request is fully excluded from Zen inspection and enforcement: Zen will not analyze the request, generate findings, or apply blocking rules for that traffic. Your application handles the request normally.

## What gets bypassed

- **Attack protection** — SQL injection, path traversal, command injection, and SSRF attacks are not blocked or reported
- **Rate limiting** — never triggered.
- **IP blocking** — Known Threat Actors, Tor traffic blocking/monitoring, country blocking, and custom IP allow/block lists are not checked.
- **Bot traffic blocking** — not checked.
- **User blocking** — blocked users are not blocked.
- **Statistics** — the request isn't counted, and doesn't count against your monitored request quota.
- **Attack wave protection** — the request doesn't count towards wave detection.
- **IDOR Protection** — SQL queries are not checked for IDOR vulnerabilities

## Usage

The following example shows how to disable Zen for a specific request in a Hono application.

```js
import { Hono } from "hono";
import Zen from "@aikidosec/firewall";

const app = new Hono();

app.use(async (c, next) => {
  // Add your custom logic here
  if (yourCustomLogic() === "true") {
    Zen.bypassRequest(); // <-- This disables Zen for this specific request
  }

  await next();
});

// Make sure to call Zen.bypassRequest() in a middleware before this to bypass Rate limiting and user blocking
Zen.addHonoMiddleware(app);

app.get("/", async (c) => {
  // Alternatively, you can also call Zen.bypassRequest() here to bypass attack blocking only for this specific route
  // This will however not bypass rate limiting or user blocking, as those are applied in the middleware

  // Your route logic here
  return c.text("Hello, World!");
});

// ...
```

> [!NOTE]
> Zen also has a built-in [Bypassed IPs](https://help.aikido.dev/zen-firewall/zen-features/bypassed-ips) feature without requiring code changes.

> [!WARNING]
> A bypassed request gets zero protection from Zen — no attack detection, no rate limiting, no blocking, no tracking. Ensure that your custom logic only bypasses requests that you fully trust.
