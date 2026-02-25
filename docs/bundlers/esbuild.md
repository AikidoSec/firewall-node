# Installing Zen in a Node.js Application Bundled with esbuild

Note: Zen runs only on the server side, it does not run in the browser.

Note: If `bundle` is set to `false` in the esbuild configuration, Zen will work without any additional configuration.
For some general information about using Zen with bundlers, please refer to the [general bundler documentation](./bundler.md).

## Using the Zen esbuild Plugin

To use Zen with esbuild, you need to install the `@aikidosec/firewall` package and add the Zen esbuild plugin to your bundler configuration like in the example below.

```js
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";

await esbuild.build({
  entryPoints: [
    /* ... */
  ],
  bundle: true,
  platform: "node",
  format: "cjs", // or "esm"
  outdir: "./dist",
  plugins: [zenEsbuildPlugin()], // <-- Add the Zen esbuild plugin here
});
```

If you are using `cjs` as output format, add the following at the top of your application entry point, above any other imports, including Zen imports:

```js
require("@aikidosec/firewall/instrument");
```

Setting an explicit output directory and build format is mandatory for the plugin to work correctly.
After configuring esbuild with the Zen plugin, you can build your application like done before.
However, **you need to ensure that the full output directory is deployed to your production environment.**

If your output format is set to `esm`, please also follow the instructions in the [ESM documentation](../esm.md) and modify your startup command accordingly.

## Alternative: Exclude external packages from bundling

Modify your esbuild configuration to set the `packages` option to `external`:

```js
const { build } = require("esbuild");

build({
  entryPoints: ["./app.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "./dist/app.js",
  packages: "external", // <-- Add this line
});
```

This tells esbuild to load packages (including @aikidosec/firewall and any packages that Zen hooks into) from the `node_modules` directory, while still bundling your application code.

⚠️ Don't forget to copy the node_modules directory to the output directory (only `dependencies`, not `devDependencies`).
