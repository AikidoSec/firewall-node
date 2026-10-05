# Installing Zen in a Node.js Application Bundled with rolldown

For some general information about using Zen with bundlers, please refer to the [general bundler documentation](./bundler.md).

## Using the Zen rolldown Plugin

To use Zen with rolldown, you need to install the `@aikidosec/firewall` package and add the Zen rolldown plugin to your rolldown configuration.

```js
// rollup.config.ts
import { zenRolldownPlugin } from "@aikidosec/firewall/bundler";

// ...
export default defineConfig({
  // ...
  platform: "node",
  output: {
    // ...
    dir: "dist",
  },
  plugins: [
    // ... other plugins ...
    zenRolldownPlugin(),
  ],
  // ...
});
```

If you are using `cjs` as output format, add the following at the top of your application entry point, above any other imports, including Zen imports:

```js
require("@aikidosec/firewall/instrument");
```

As shown above, add the `zenRolldownPlugin()` to the `plugins` array in your rolldown configuration.
Also make sure to include the `platform: "node"` option in your configuration, so that rolldown knows you are building a Node.js application.
Setting an explicit output directory is mandatory for the plugin to work correctly.

After configuring rolldown with the Zen plugin, you can build your application as usual using the rolldown CLI or API.
However, **you need to ensure that the full output directory is deployed to your production environment.**

If your output format is set to `esm`, please also follow the instructions in the [ESM documentation](../esm.md) and modify your startup command accordingly.
