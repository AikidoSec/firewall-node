# Express

At the very beginning of your app.js file, add the following line:

```js
require('@aikidosec/runtime'); // <-- Include this before any other code or imports

const express = require('express');

const app = express();

// ...
```

or ESM import style:

```js
import '@aikidosec/runtime';

// ...
```

That's it! Your app is now protected by Aikido runtime.

If you want to see a full example, check our [express sample app](../sample-apps/express-mongodb).

## Blocking mode

By default, the runtime will run in non-blocking mode. When runtime detects an attack, it will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`:

```sh
AIKIDO_BLOCKING=true node app.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the runtime, you can run your express app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Aikido runtime can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

## User identification

If you want to identify the user making the request, you can add a middleware to your express app that sets the `aikido` property on the request object.

This will enable you to block specific users from making requests to your application or rate limit certain endpoints based on the user (using the Aikido dashboard).

For example:

```
app.use(
  (req, res, next) => {
    req.aikidoUser = {
      user: {
        id: '1234',
        name: 'John Doe', // optional
      },
    };
    next();
  }
);
```
