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

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCK` to `true`:

```sh
AIKIDO_BLOCK=true node app.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Rate limiting and user blocking

If you want to add the rate limiting feature to your app, modify your code like this:

```js
const Zen = require("@aikidosec/firewall");

module.exports = async (req, res) => {
  // Optional, if you want to use user based rate limiting or block specific users
  Zen.setUser({
    id: "123",
    name: "John Doe", // Optional
  });

  // Call this as early as possible before your request handling code, e.g. in a middleware, after you know your user
  const result = Zen.shouldBlockRequest();

  if (result.block) {
    if (result.type === "ratelimited") {
      let message = "You are rate limited by Zen.";
      if (result.trigger === "ip" && result.ip) {
        // Please note that outputting user input is always a security risk. Make sure to escape it properly.
        message += ` (Your IP: ${result.ip})`;
      }

      // Block the request and send a http 429 status code
      res.statusCode = 429;
      return res.end(message);
    }

    if (result.type === "blocked") {
      // Return a http 403 response
      res.statusCode = 403;
      return res.end("You are blocked by Zen.");
    }
  }
};
```

## Debug mode

If you need to debug the firewall, you can run your micro app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

That's it! Your app is now protected by Zen.

If you want to see a full example, check our [micro sample app](../sample-apps/micro).
