# LoopBack 4

At the very beginning of your `index.ts` file, add the following line:

```js
import "@aikidosec/firewall"; // <-- Include this before any other code or imports

// ...
```

> [!NOTE]
> Many TypeScript projects use `import` syntax but still compile to CommonJS — in that case, the setup above works as-is. If your app runs as **native ESM** at runtime (e.g. `"type": "module"` in package.json), see [ESM setup](./esm.md) for additional steps.

## Blocking mode

By default, the firewall will run in non-blocking mode. When it detects an attack, the attack will be reported to Aikido if the environment variable `AIKIDO_TOKEN` is set and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCK` to `true`:

```sh
AIKIDO_BLOCK=true npm start
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Rate limiting and user blocking

If you want to add the rate limiting feature to your app, you can create a new middleware.

```ts
// src/middleware/zen.middleware.ts
import { shouldBlockRequest } from "@aikidosec/firewall";
import { HttpErrors, type Middleware } from "@loopback/rest";

export const zenMiddleware: Middleware = async (middlewareCtx, next) => {
  const result = shouldBlockRequest();

  if (result.block) {
    if (result.type === "ratelimited") {
      let message = "You are rate limited by Zen.";
      if (result.trigger === "ip" && result.ip) {
        message += ` (Your IP: ${result.ip})`;
      }

      throw new HttpErrors.TooManyRequests(message);
    }

    if (result.type === "blocked") {
      throw new HttpErrors.Forbidden("You are blocked by Zen.");
    }
  }

  return next();
};
```

After creating the middleware, add it to your app:

```ts
// src/applications.ts

export class Loopback4Application extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication))
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);
    this.sequence(MySequence);
    this.bodyParser(JsonBodyParser);

    // ...

    this.middleware(zenMiddleware); // <- Add this line and import the middleware at the top of the file

    // ...
  }
  // ...
}
```

## Debug mode

If you need to debug the firewall, you can run your NestJS app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true npm start
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).

## Preventing prototype pollution

Zen can also protect your application against prototype pollution attacks.

Read [Protect against prototype pollution](./prototype-pollution.md) to learn how to set it up.

That's it! Your app is now protected by Zen.  
If you want to see a full example, check our [LoopBack 4 example app](../sample-apps/loopback4-psql).
