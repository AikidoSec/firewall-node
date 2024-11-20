# Installing Zen in a Node.js Application Bundled with esbuild

Note: Zen runs only on the server side, it does not run in the browser.

Zen works by intercepting `require()` calls that a Node.js application makes when loading modules. This includes modules that are built-in to Node.js, like the `fs` module for accessing the filesystem, as well as modules installed from the NPM registry, like the `pg` database module.

Bundlers crawl all of the `require()` calls that an application makes to files on disk. It replaces the `require()` calls with custom code and combines all the resulting JavaScript into one "bundled" file. When a built-in module is loaded, such as `require('fs')`, that call can then remain the same in the resulting bundle.

Zen stops working at this point. They can continue to intercept the calls for built-in modules but don't intercept calls to third party libraries. This means that when you bundle a Zen app with a bundler it is likely to capture information about disk access (through `fs`) and outbound HTTP requests (through `http`), but omit calls to third party libraries.

The solution is to treat all third party modules that Zen needs to instrument as being "external" to the bundler. With this setting the instrumented modules remain on disk and continue to be loaded with `require()` while the non-instrumented modules are bundled.

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

This tells esbuild to exclude @aikidosec/firewall and any packages that Zen hooks into from the bundle.