# Installing Zen in a Node.js Application Bundled with esbuild

If you're using esbuild to bundle your Node.js application with `platform: "node"`, you need to ensure that Zen and its dependencies (including any packages that Zen hooks into) are correctly handled.

Note: Zen only runs on the server side, it does not run in the browser.

When bundling your application with esbuild, you need to ensure that Zen and any packages it hooks into are correctly handled.

To address this, you can use the utility function provided by Zen to automatically exclude the necessary packages from your bundle.

Modify your esbuild configuration to include the external option using this utility:

```js
const { build } = require("esbuild");
const { externals } = require("@aikidosec/firewall/bundler");

build({
  entryPoints: ["./app.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "./dist/app.js",
  external: externals(),
});
```

This tells esbuild to exclude @aikidosec/firewall and any packages that Zen hooks into from the bundle. These packages will then be required at runtime, ensuring that Zen operates correctly.
