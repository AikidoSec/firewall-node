# Installing Zen in a Node.js Application that uses a bundler

⚠️ Note: Zen runs only on the server side, it does not run in the browser.

Zen might not work out of the box with bundlers, depending on how they are configured.
To ensure that Zen can properly instrument your code and protect your application, you may need to adjust your bundler settings.

A bundler plugin and specific instructions are available for the following bundlers:

- [esbuild](./bundlers/esbuild.md)
- [rolldown](./bundlers/rolldown.md)

If your bundler is not listed here, please refer to the general guidelines below and consider reaching out to us for assistance.

## Why do I need to change my bundler configuration?

Zen works by intercepting the import process of Node.js applications makes when loading modules. This includes modules that are built-in to Node.js, like the `node:fs` module for accessing the filesystem, as well as modules installed from the NPM registry, like the `pg` database module.

Bundlers like esbuild crawl all imports of an application and combine all the resulting JavaScript into one "bundled" file, except Node.js built-in modules such as `require('node:fs')`.
Zen can continue to intercept the calls for built-in modules but cannot intercept calls to third party libraries under those conditions. This means that when you bundle a Zen app with a bundler Zen is likely to capture information about disk access (through `fs`) and outbound HTTP requests (through `http`), but omit calls to third party libraries.

## When do I not need to use the bundler plugin?

If your bundler is already configured to exclude all external packages from the bundle, Zen will work without any additional configuration.
This means that the `node_modules` folder is available in your production environment and all packages are loaded from there.

If your bundler is just transpiling your code (e.g., from TypeScript to JavaScript) without bundling, Zen will also work without any additional configuration.
