# Installing Zen in a Node.js Application that uses a bundler

⚠️ Note: Zen runs only on the server side, it does not run in the browser.

Zen might not work out of the box with bundlers, depending on how they are configured.
To ensure that Zen can properly instrument your code and protect your application, you may need to adjust your bundler settings.

In order to be compatible with Zen, your bundler needs to be configured to exclude all external packages from the bundle.
You can also choose to only exclude Zen and all the packages that should be protected.
In this case, your production environment still needs the `node_modules` folder.

If you are using esbuild, you can find [more information here](./esbuild.md).

If it is not possible to exclude all packages from bundling, Zen provides the following helper function to get a list of all the packages that need to be excluded:

```javascript
const { externals } = require("@aikidosec/firewall/bundler");

externals(); // Returns an array of package names
```
