# Next.js

Right now, we only support Next.js in standalone mode:

```js
const nextConfig = {
  output: "standalone",
};
```

When starting your server, you need to use `--require @aikidosec/runtime`:

```sh
node --require @aikidosec/runtime .next/standalone/server.js
```

If you're using Docker:

```Dockerfile
CMD node --require @aikidosec/runtime server.js
```

You can also use the runtime when developing locally by updating the `dev` and `start` scripts in your `package.json`:

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='-r @aikidosec/runtime' next dev",
    "start": "NODE_OPTIONS='-r @aikidosec/runtime' next start"
  }
}
```

Note: Including `@aikidosec/runtime` in `middleware.js` or `instrumentation.js` will not work due to the build process of Next.js.
