# Setting the token at runtime

Zen normally reads the token from the `AIKIDO_TOKEN` environment variable. If you can't set env vars — for example, your token lives in AWS Secrets Manager — you can set it at runtime instead.

## How it works

1. Call `prepare()` at startup. This starts Zen's instrumentation without a token.
2. Fetch your token async (secrets manager, config service, wherever).
3. Call `setToken(token)` to connect to the Aikido platform.

Zen detects attacks from step 1, but won't report them until you call `setToken`.

## Example with AWS Secrets Manager

```js
const Zen = require("@aikidosec/firewall");

// Start instrumentation without a token
Zen.prepare();

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

async function loadToken() {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: "my-secret" })
  );
  return response.SecretString;
}

loadToken().then((token) => {
  Zen.setToken(token);
});
```

## With ESM

Create a setup file for ESM:

```js
// zen-setup.cjs
const { prepare } = require("@aikidosec/firewall/instrument");

prepare();
```

Start your app with:

```sh
node -r ./zen-setup.cjs app.js
```

Then call `setToken` in your application code:

```js
import { setToken } from "@aikidosec/firewall";

const token = await fetchTokenFromSecretsManager();
setToken(token);
```

## With Lambda

Call `prepare()` before wrapping your handler:

```js
const Zen = require("@aikidosec/firewall");
Zen.prepare();

const zen = require("@aikidosec/firewall/lambda");

module.exports.handler = zen(async (event) => {
  // Your handler code
});

// Fetch token outside the handler so it runs once during cold start
loadToken().then((token) => {
  Zen.setToken(token);
});
```

## Notes

- Call `prepare()` as early as possible, before other packages are loaded.
- `setToken` only works once. Calling it again is ignored.
- If `AIKIDO_TOKEN` is already set in the environment, you don't need `prepare()` or `setToken()`. Calling them anyway is fine — they just do nothing.
