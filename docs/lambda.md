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

or using `import` syntax:

```js
import protect from "@aikidosec/firewall/lambda";

// ...
```

> [!NOTE]
> Many TypeScript projects use `import` syntax but still compile to CommonJS — in that case, the setup above works as-is. If your app runs as **native ESM** at runtime (e.g. `"type": "module"` in package.json), see [ESM setup](./esm.md) for additional steps.

Right now, we support the following triggers:

- Gateway API
- SQS (Simple Queue Service)

- If you're using a different trigger, please let us know.

That's it! Your AWS Lambda function is now protected by Zen.

If you want to see a full example, check our [lambda sample app](../sample-apps/lambda-mongodb).

## Using with Middy

If you're using [Middy](https://middy.js.org/) as a middleware framework for your Lambda functions, wrap the Middy handler with `protect`:

<!-- prettier-ignore-start -->
```js
const protect = require("@aikidosec/firewall/lambda");
const middy = require("@middy/core");

const lambdaHandler = (event, context) => {
  // Your business logic
  return doSomethingUsefulWith(event);
};

exports.handler = protect(
  middy(lambdaHandler).use(/* your middleware */)
);
```
<!-- prettier-ignore-end -->

or using `import` syntax:

<!-- prettier-ignore-start -->
```js
import protect from "@aikidosec/firewall/lambda";
import middy from "@middy/core";

const lambdaHandler = (event, context) => {
  // Your business logic
  return doSomethingUsefulWith(event);
};

export const handler = protect(
  middy(lambdaHandler).use(/* your middleware */)
);
```
<!-- prettier-ignore-end -->

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`.

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the firewall, you can run your lambda with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Data reporting

To minimize impact on Lambda execution time, Zen reports data to the Aikido platform on the first invocation and then every 10 minutes.

Attack events are reported immediately when they occur.

## Timeout configuration

By default, Zen uses a 1-second timeout for API requests to minimize impact on Lambda execution time.

If you're experiencing timeout errors (e.g., due to slow network connections or specific AWS regions), you can increase the timeout using the `AIKIDO_LAMBDA_TIMEOUT_MS` environment variable:

```bash
AIKIDO_LAMBDA_TIMEOUT_MS=5000  # 5 seconds
```

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.
