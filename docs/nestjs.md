# NestJS

💡 NestJS can use different web frameworks like express (default) and fastify. If you use a custom web framework integration, please make sure that it's supported by Zen.

At the very beginning of your main.ts file, add the following line:

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

If you want to add the rate limiting feature to your app, you can create a new [guard](https://docs.nestjs.com/guards) and add it to your routes.

```ts
// src/zen.guard.ts
import {
  Injectable,
  CanActivate,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { shouldBlockRequest } from "@aikidosec/firewall";

@Injectable()
export class ZenGuard implements CanActivate {
  canActivate(): boolean | Promise<boolean> | Observable<boolean> {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${result.ip})`;
        }

        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      }

      if (result.type === "blocked") {
        throw new HttpException(
          "You are blocked by Zen.",
          HttpStatus.FORBIDDEN
        );
      }
    }

    return true;
  }
}
```

After creating the guard, you can add it to specific routes or to the whole application:

```ts
// src/main.ts
const app = await NestFactory.create(AppModule);
app.useGlobalGuards(new ZenGuard());
// ...
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
If you want to see a full example, check our [NestJS sample app](../sample-apps/nestjs-sentry).
