# Express

At the very beginning of your app.js file, add the following line:

```js
require("@aikidosec/firewall"); // <-- Include this before any other code or imports

const express = require("express");

const app = express();

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

const app = express();

// Call this as early as possible, before other middleware
// If you want to use user based rate limiting or blocking, you need to call Zen.setUser(...) in a middleware before this
Zen.setupExpressIntegration(app);
```

## Debug mode

If you need to debug the firewall, you can run your express app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

That's it! Your app is now protected by Zen.  
If you want to see a full example, check our [express sample app](../sample-apps/express-mongodb).
