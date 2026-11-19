# Installing Zen in a Node.js Application Bundled with tsup

Note: Zen runs only on the server side, it does not run in the browser.

Note: If `bundle` is set to `false` in the tsup configuration, Zen will work without any additional configuration.
For some general information about using Zen with bundlers, please refer to the [general bundler documentation](./bundler.md).

## Using the Zen esbuild Plugin

To use Zen with tsup, you need to install the `@aikidosec/firewall` package and add the Zen esbuild plugin to your bundler configuration like in the example below.

```js
import { cp, mkdir, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";

export default defineConfig({
  entry: ["src/app.ts"],
  bundle: true,
  platform: "node",
  format: "cjs", // or "esm"
  outDir: "dist",
  esbuildPlugins: [zenEsbuildPlugin()], // <-- Add the Zen esbuild plugin here
});
```

If you are using `cjs` as output format, add the following at the top of your application entry point, above any other imports, including Zen imports:

```js
require("@aikidosec/firewall/instrument");
```

Setting an explicit output directory and build format is mandatory for the plugin to work correctly.
After configuring tsup with the Zen plugin, you can build your application like done before.
However, **you need to ensure that the full output directory is deployed to your production environment.**

If your output format is set to `esm`, please also follow the instructions in the [ESM documentation](../esm.md) and modify your start command accordingly.
