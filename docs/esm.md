# Adding Zen to an ESM application

> [!WARNING]  
> The new instrumentation system with ESM support is still under active development and not suitable for production use.

Modify the start command of your application to include the Zen firewall:

```sh
node -r @aikidosec/firewall/instrument your-app.js
```

Alternatively, you can set the `NODE_OPTIONS` environment variable to include the Zen firewall:

```sh
export NODE_OPTIONS='-r @aikidosec/firewall/instrument'
```

> [!IMPORTANT]  
> Please also check the documentation on how to integrate Zen with your used web framework.

## Known issues

- The app might crash on startup if used together with some packages that use the Node.js Asynchronous Module Customization Hooks, like Sentry or OpenTelemetry, due to bugs in Node.js itself.
- Zen can not protect ESM sub-dependencies of an ESM package. For example if an ESM package `foo` imports a sub-dependency `bar` that is also an ESM package, Zen will not be able to protect the code in `bar`. This is because the V8 engine does not allow Node.js to observe the evaluation of inner ESM packages (yet).

Relevant links:

- [ERR_INVALID_RETURN_PROPERTY_VALUE when using module.register and module.registerHooks (#57327)](https://github.com/nodejs/node/issues/57327)
- [module.registerHooks() tracking issue (#56241)](https://github.com/nodejs/node/issues/56241)
- [TypeError when json file is required in hook and in the imported file (#57358)](https://github.com/nodejs/node/issues/57358)
- [ERR_INTERNAL_ASSERTION: Unexpected module status 3 (#58515)](https://github.com/nodejs/node/issues/58515)
- [Adding an evaluation hook for v8::Module](https://issues.chromium.org/u/1/issues/384413088)
