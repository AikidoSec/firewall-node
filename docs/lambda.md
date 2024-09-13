# AWS Lambda

At the very beginning of the file that contains your handler, add the following line:

```js
const protect = require("@aikidosec/firewall/lambda"); // <-- Include this before any other code or imports

const dependency = require("dependency");

exports.handler = protect(async (event, context) => {
  // <-- Wrap your handler with protect
  // ...
});
```

or ESM import style:

```js
import protect from "@aikidosec/firewall/lambda";

// ...
```

Right now, we support the following triggers:

- Gateway API
- SQS (Simple Queue Service)

- If you're using a different trigger, please let us know.

That's it! Your AWS Lambda function is now protected by Zen.

If you want to see a full example, check our [lambda sample app](../sample-apps/lambda-mongodb).

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`.

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the firewall, you can run your lambda with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.
