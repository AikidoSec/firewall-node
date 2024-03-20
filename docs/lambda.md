# AWS Lambda

At the very beginning of the file that contains your handler, add the following line:

```js
const { lambda, preventPrototypePollution } = require("@aikidosec/runtime");

const protect = lambda(); // <-- Call this before any other code or imports

const dependency = require("dependency");

preventPrototypePollution(); // <-- Call this after your main imports

exports.handler = protect(async (event, context) => { // <-- Wrap your handler with protect
  // ...
});
```

You can read more about `preventPrototypePollution` [here](./prototype-pollution.md).

or ESM import style:

```js
import { lambda, preventPrototypePollution } from '@aikidosec/runtime';
```

In order for the runtime to work properly, we need the following event properties to be present:

* `event.body`
* `event.headers`

That's it! Your AWS Lambda function is now protected by Aikido runtime.

If you want to see a full example, check our [lambda sample app](../sample-apps/lambda-mongodb).

## Debug mode

If you need to debug the runtime, you can set the `debug` option to `true`:

```js
protect({ debug: true });
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
