# Google Cloud Functions

If you're using the `@google-cloud/functions-framework` package to register your handlers, your cloud function will be protected by Zen automatically:

```js
require("@aikidosec/firewall/cloud-function"); // <-- Include this before any other code or imports

const functions = require("@google-cloud/functions-framework");

functions.http("handler", async (req, res) => {
  // ...
});
```

or using `import` syntax:

```js
import "@aikidosec/firewall/cloud-function";

// ...
```

> [!NOTE]
> Many TypeScript projects use `import` syntax but still compile to CommonJS — in that case, the setup above works as-is. If your app runs as **native ESM** at runtime (e.g. `"type": "module"` in package.json), see [ESM setup](./esm.md) for additional steps.

If you're using the `exports.handler` style, you'll need to wrap your handler manually.

At the very beginning of the file that contains your handler, add the following line:

```js
const protect = require("@aikidosec/firewall/cloud-function"); // <-- Include this before any other code or imports

const dependency = require("dependency");

exports.handler = protect(async (event, context) => {
  // <-- Wrap your handler with protect
  // ...
});
```

or using `import` syntax:

```js
import protect from "@aikidosec/firewall/cloud-function";

// ...
```

That's it! Your cloud function is now protected by Zen.

If you want to see a full example, check our [cloud functions sample app](../sample-apps/cloud-functions-v1-mongodb).

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`.

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the firewall, you can run your cloud function with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Data reporting

Zen periodically flushes collected data (request stats, etc.) to the Aikido dashboard. By default this happens on the first invocation and then every 10 minutes.

Attack events are sent right away. In Cloud Functions, Zen awaits these before your handler returns so they don't get lost when GCP freezes the instance.

Since Cloud Function instances can be killed at any time by GCP, you may want a shorter flush interval so less data is lost. Set `AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS` (minimum 60000):

```bash
AIKIDO_CLOUD_FUNCTION_FLUSH_EVERY_MS=300000  # 5 minutes (default: 600000)
```

A shorter interval means data shows up faster. Once every interval, a single invocation takes a bit longer because the flush happens inline.

## Timeout configuration

On cold start, Zen fetches its configuration from the Aikido API. It also makes API calls during each flush. These calls have a timeout to avoid slowing down your function.

The default is 1 second. If you see timeout errors in your logs, increase it:

```bash
AIKIDO_CLOUD_FUNCTION_TIMEOUT_MS=5000  # 5 seconds (default: 1000)
```

This is not related to your Cloud Function's own timeout in GCP. It only controls how long Zen waits for its own API calls.

## Unsupported features

The following features are not available in serverless environments:

- Rate limiting
- Tor traffic blocking
- Bot blocking
- IP blocking by known threat actors
- Blocking by country
- Manual user/IP blocking

See the [serverless feature limitations](https://help.aikido.dev/zen-firewall/zen-installation-instructions/setup-and-installation-of-zen-firewall-for-serverless-environments#feature-limitations) for more details.

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.
