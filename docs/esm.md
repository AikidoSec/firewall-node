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

## Loading environment variables

When using `--require`/`-r` to preload the Zen firewall, the instrumentation hook runs before your application code. This means environment variables loaded by packages like `dotenv` will not be available when Zen starts.

To ensure `AIKIDO_TOKEN` and other environment variables are available during instrumentation, use Node.js's native `--env-file` flag:

```sh
node --env-file=.env -r @aikidosec/firewall/instrument your-app.js
```

> [!NOTE]
> The `--env-file` flag cannot be used in `NODE_OPTIONS`.

## Use Zen together with Sentry (ESM)

You need to use Node.js v24.11.1 / v25.1.0 or later to use Zen together with Sentry in an ESM application.
Follow the [Sentry instructions for ESM](https://docs.sentry.io/platforms/javascript/guides/node/install/esm/) to set up Sentry. After that, make sure to preload Zen using `--require`/`-r` before loading Sentry:

```sh
node -r @aikidosec/firewall/instrument --import ./instrument.mjs your-app.js
```

## Known issues

- Zen can not protect ESM sub-dependencies of an ESM package. For example if an ESM package `foo` imports a sub-dependency `bar` that is also an ESM package, Zen will not be able to protect the code in `bar`. This is because the V8 engine does not allow Node.js to observe the evaluation of inner ESM packages (yet). Open issue: [Adding an evaluation hook for v8::Module](https://issues.chromium.org/u/1/issues/384413088). See a full example below.

## Solved issues

- Solved in Node.js v24.11.1 / v25.1.0. - The app might crash on startup if used together with some packages that use the Node.js Asynchronous Module Customization Hooks, like Sentry or OpenTelemetry, due to bugs in Node.js itself. Issue: [ERR_INVALID_RETURN_PROPERTY_VALUE when using module.register and module.registerHooks (#57327)](https://github.com/nodejs/node/issues/57327)
- Fixed in Node.js v24.3.0. - [ERR_INTERNAL_ASSERTION: Unexpected module status 3 (#58515)](https://github.com/nodejs/node/issues/58515)
- Not solved in Node.js, but workaround used. - [TypeError when json file is required in hook and in the imported file (#57358)](https://github.com/nodejs/node/issues/57358). Make sure to always use `--require` to preload the Zen firewall and do not use `--import`.

Relevant links:

- [module.registerHooks() tracking issue (#56241)](https://github.com/nodejs/node/issues/56241)

### Example of unprotected ESM sub-dependency

Consider this scenario where your application uses an ESM package that has ESM sub-dependencies:

**Your app.js:**

```js
import { logUserAction } from "analytics-client"; // ESM package
app.post("/user/action", async (req, res) => {
  await logUserAction(req.body.userId, req.body.action);
  res.json({ success: true });
});
```

**node_modules/analytics-client/index.js (dependency):**

```js
import { storeEvent } from "analytics-db-helper";
export async function logUserAction(userId, action) {
  const eventData = `INSERT INTO user_events (user_id, action, timestamp) VALUES (${userId}, '${action}', NOW())`;
  return await storeEvent(eventData);
}
```

**node_modules/analytics-db-helper/index.js (another sub-dependency):**

```js
import mysql from "mysql2/promise";
export async function storeEvent(sql) {
  // Zen CANNOT instrument this mysql.execute call!
  // V8 doesn't allow Node.js to observe evaluation of this inner ESM module
  const connection = await mysql.createConnection(config);
  try {
    const result = await connection.execute(sql);
    return result;
  } finally {
    await connection.end();
  }
}
```

In this example, if `req.body` contained a SQL injection payload, Zen would miss detecting it at the actual `mysql.execute` level inside the ESM sub-dependency, since it cannot instrument third-party packages within ESM sub-dependencies.
