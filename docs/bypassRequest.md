# Bypass Zen for a specific request

To disable Zen for a specific request, you can use the `bypassRequest` function in a middleware. This allows you to bypass Zen's security checks and stats collection for that request.
Please note that Zen already has a built-in feature for disabling Zen for IP addresses, but this feature offers greater flexibility, allowing you to disable Zen for specific requests based on any criteria you choose.

> [!WARNING]
> Please use this feature with caution, as it can potentially expose your application to security risks if not used properly.

The following example shows how to disable Zen for a specific request in a Hono application.

```js
import { Hono } from "hono";
import Zen from "@aikidosec/firewall";

const app = new Hono();

app.use(async (c, next) => {
  if (yourCustomLogic() === "true") {
    Zen.bypassRequest(); // <-- This disables Zen for this specific request
  }

  await next();
});

Zen.addHonoMiddleware(app);

app.get("/", async (c) => {
  // Your route logic here
  return c.text("Hello, World!");
});

// ...
```
