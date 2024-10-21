# Micro

Since micro loads your handler from a file, you'll need to use `NODE_OPTIONS` to load the Zen agent before the `http` module is loaded:

```json
{
  "scripts": {
    "start": "NODE_OPTIONS='-r @aikidosec/firewall' micro"
  }
}
```

or when using `node`:

```sh
node --require @aikidosec/firewall ./node_modules/.bin/micro
```

That's it! Your app is now protected by Zen.

If you want to see a full example, check our [micro sample app](../sample-apps/micro).

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`:

```sh
AIKIDO_BLOCKING=true node app.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug the firewall, you can run your express app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.
