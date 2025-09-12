# Hono

💡 Hono runs on more JavaScript runtimes than just Node.js. Right now, Zen only supports Node.js.

At the very beginning of your app.js file, add the following line:

```js
require("@aikidosec/firewall"); // <-- Include this before any other code or imports

const { Hono } = require("hono");

const app = Hono();

// ...
```

or ESM import style:

```js
import "@aikidosec/firewall";

// ...
```

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido if the environment variable `AIKIDO_TOKEN` is set and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCK` to `true`:

```sh
AIKIDO_BLOCK=true node app.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Rate limiting and user blocking

If you want to add the rate limiting feature to your app, modify your code like this:

```js
const Zen = require("@aikidosec/firewall");

const app = Hono();

// Optional, if you want to use user based rate limiting or block specific users
app.use(async (c, next) => {
  // Get the user from your authentication middleware
  // or wherever you store the user
  Zen.setUser({
    id: "123",
    name: "John Doe", // Optional
  });

  await next();
});

// Call this after auth middleware, as early as possible in the middleware stack
Zen.addHonoMiddleware(app);

app.get(...);
```

## Debug mode

If you need to debug the firewall, you can run your Hono app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

That's it! Your app is now protected by Zen.  
If you want to see a full example, check our [hono sample app](../sample-apps/hono-mongodb).
