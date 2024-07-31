# Next.js

At this moment, Aikido Firewall only supports the standalone output in Next.js. To configure your Next.js app to use standalone output, you need to set the output property in your `next.config.js` file:

```js
const nextConfig = {
  output: "standalone",
};
```

After building your Next.js app, you can run the standalone server with the following command:

```sh
node -r @aikidosec/firewall .next/standalone/server.js
```

If you're using Docker:

```Dockerfile
CMD node -r @aikidosec/firewall server.js
```

You can also use the firewall when developing locally by updating the `dev` and `start` scripts in your `package.json`:

```json
{
  "scripts": {
    "build": "next build",
    "dev": "NODE_OPTIONS='-r @aikidosec/firewall' next dev",
    "start": "NODE_OPTIONS='-r @aikidosec/firewall' next start"
  }
}
```

Note: Including `@aikidosec/firewall` in `middleware.js` or `instrumentation.js` will not work due to the build process of Next.js.

## Caveats

1. Rate limiting by user ID is not supported because `setUser` is not supported due to the bundling process of Next.js.
2. Same for blocking of specific users (requires `setUser`).
3Attack detection only works for modules that are listed in the [`serverComponentsExternalPackages`](https://nextjs.org/docs/app/api-reference/next-config-js/serverComponentsExternalPackages). For example, `pg` is supported, but `mysql` is not.

## Blocking mode

By default, Aikido firewall will run in detection only mode. When it detects an attack, the attack will be reported to Aikido and continue executing the call.

You can enable blocking mode by setting the environment variable `AIKIDO_BLOCKING` to `true`:

```sh
AIKIDO_BLOCKING=true node -r @aikidosec/firewall .next/standalone/server.js
```

It's recommended to enable this on your staging environment for a considerable amount of time before enabling it on your production environment (e.g. one week).

## Debug mode

If you need to debug Aikido firewall, you can run your next app with the environment variable `AIKIDO_DEBUG` set to `true`:

```sh
AIKIDO_DEBUG=true node -r @aikidosec/firewall .next/standalone/server.js
```

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
