# Google Cloud Functions

If you're the `@google-cloud/functions-framework` package, your cloud function will be protected by Aikido runtime automatically:

```js
const { protect } = require("@aikidosec/runtime");

protect(); // <-- Call this before any other code or imports

const functions = require("@google-cloud/functions-framework");

preventPrototypePollution(); // <-- Call this after your main imports

functions.http("handler", async (req, res) => {
  // ...
});
```

If you're using the `exports.handler` style, you'll need to wrap your handler manually.

At the very beginning of the file that contains your handler, add the following line:

```js
const { cloudFunction, preventPrototypePollution } = require("@aikidosec/runtime");

const protect = cloudFunction(); // <-- Call this before any other code or imports

const dependency = require("dependency");

preventPrototypePollution(); // <-- Call this after your main imports

exports.handler = protect(async (event, context) => { // <-- Wrap your handler with protect
  // ...
});
```

You can read more about `preventPrototypePollution` [here](./prototype-pollution.md).

or ESM import style:

```js
import { cloudFunction, preventPrototypePollution } from '@aikidosec/runtime';
```

That's it! Your cloud function is now protected by Aikido runtime.

If you want to see a full example, check our [cloud functions sample app](../sample-apps/cloud-functions-v1-mongodb).

## Debug mode

If you need to debug the runtime, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
