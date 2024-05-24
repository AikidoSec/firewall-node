# Next.js

Right now, we only support Next.js in standalone mode.

In your next config:

```js
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

When starting your server, you need to use `--require @aikidosec/runtime`:

```sh
node --require @aikidosec/runtime .next/standalone/server.js
```

If you're using Docker:

```Dockerfile
CMD node --require @aikidosec/runtime server.js
```

Note: Including `@aikidosec/runtime` in `middleware.js` or `instrumentation.js` will not work due to the build process of Next.js.
