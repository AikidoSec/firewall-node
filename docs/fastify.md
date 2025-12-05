# Fastify

At the very beginning of your app.js file, add the following line:

```js
require("@aikidosec/firewall"); // <-- Include this before any other code or imports

const Fastify = require("fastify");

const fastify = Fastify();

// ...
```

or ESM import style:

```js
import "@aikidosec/firewall";

// ...
```

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido if the environment variable `AIKIDO_TOKEN` is set and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCK` to `true`:

```sh
AIKIDO_BLOCK=true node app.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Rate limiting and user blocking

If you want to add the rate limiting feature to your app, modify your code like this:

```js
const Zen = require("@aikidosec/firewall");

const fastify = Fastify();

// Optional, if you want to use user based rate limiting or block specific users
fastify.addHook('onRequest', (request, reply, done) => {
  // Get the user from the request
  // or wherever you store the user
  Zen.setUser({
    id: "123",
    name: "John Doe", // Optional
  });

  done();
});

// Call this after auth middleware, as early as possible in the middleware stack
Zen.addFastifyHook(fastify);

fastify.route(...);
```

**Note:** The `addFastifyHook` function uses the `onRequest` hook stage, which runs early in the [Fastify request lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/) and is recommended when your authentication check uses request headers (like JWT tokens). The `onRequest` and `preParsing` stages do not parse the request body, unlike the `preHandler` stage. This avoids potential DoS attacks from parsing large request bodies for unauthorized requests.

### Using `preHandler` for authentication

If you need to authenticate using a preHandler (e.g., when your authentication logic needs access to the parsed request body), you can use the exported `fastifyHook` function directly:

```js
const Zen = require("@aikidosec/firewall");

const fastify = Fastify();

async function authenticate(request, reply) {
  // Your authentication logic here
  request.user = await getUserFromRequest(request, reply);

  Zen.setUser({
    id: request.user.id,
    name: request.user.name, // Optional
  });
}

fastify.get(
  "/dashboard",
  {
    preHandler: [authenticate, Zen.fastifyHook],
    // ^ Add the Zen hook after your authentication logic
  },
  async (request, reply) => {
    return { message: "Welcome to your dashboard!" };
  }
);
```

This approach allows user blocking and rate limiting to work properly when authentication runs in the `preHandler` stage where the request body is parsed.

## Debug mode

If you need to debug the firewall, you can run your Fastify app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node app.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

That's it! Your app is now protected by Zen.  
If you want to see a full example, check our [fastify sample app](../sample-apps/fastify-mysql2).
