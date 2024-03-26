# AWS Lambda

At the very beginning of the file that contains your handler, add the following line:

```js
const { lambda } = require("@aikidosec/runtime");

const protect = lambda(); // <-- Call this before any other code or imports

const dependency = require("dependency");

exports.handler = protect(async (event, context) => { // <-- Wrap your handler with protect
  // ...
});
```

or ESM import style:

```js
import { lambda } from '@aikidosec/runtime';
```

In order for the runtime to work properly, we need the following event properties to be present:

* `event.body`
* `event.headers`

That's it! Your AWS Lambda function is now protected by Aikido runtime.

If you want to see a full example, check our [lambda sample app](../sample-apps/lambda-mongodb).

## Preventing prototype pollution

Aikido runtime can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

## Debug mode

If you need to debug the runtime, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
