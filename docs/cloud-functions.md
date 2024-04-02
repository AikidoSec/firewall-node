# Google Cloud Functions

If you're using the `@google-cloud/functions-framework` package to register your handlers, your cloud function will be protected by Aikido runtime automatically:

```js
require("@aikidosec/runtime"); // <-- Include this before any other code or imports

const functions = require("@google-cloud/functions-framework");

functions.http("handler", async (req, res) => {
  // ...
});
```

or ESM import style:

```js
import '@aikidosec/runtime';

// ...
```

If you're using the `exports.handler` style, you'll need to wrap your handler manually.

At the very beginning of the file that contains your handler, add the following line:

```js
const protect = require("@aikidosec/runtime/cloud-function"); // <-- Include this before any other code or imports

const dependency = require("dependency");

exports.handler = protect(async (event, context) => { // <-- Wrap your handler with protect
  // ...
});
```

or ESM import style:

```js
import protect from '@aikidosec/runtime/cloud-function';

// ...
```

That's it! Your cloud function is now protected by Aikido runtime.

If you want to see a full example, check our [cloud functions sample app](../sample-apps/cloud-functions-v1-mongodb).

## TypeScript

> TS2307: Cannot find module @aikidosec/runtime/cloud-function or its corresponding type declarations.

If you encounter this error, you can use `node16` or `nodenext` as module resolution in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "node16"
  }
}
```

(This is because the `@aikidosec/runtime` package uses `exports` field in `package.json`)

## Blocking mode

By default, the runtime will run in non-blocking mode. When runtime detects an attack, it will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCK` to `true`.

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the runtime, you can run your cloud function with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Aikido runtime can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.
