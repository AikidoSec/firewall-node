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

### Example of unprotected ESM sub-dependency

Consider this scenario where your application uses an ESM package that has ESM sub-dependencies:

**Your app.js:**
```js
import { logUserAction } from 'analytics-client'; // ESM package
app.post('/user/action', async (req, res) => {
  await logUserAction(req.body.userId, req.body.action);
  res.json({ success: true });
});
```

**node_modules/analytics-client/index.js (dependency):**
```js
import { storeEvent } from 'analytics-db-helper';
export async function logUserAction(userId, action) {
  const eventData = `INSERT INTO user_events (user_id, action, timestamp) VALUES (${userId}, '${action}', NOW())`;
  return await storeEvent(eventData);
}
```

**node_modules/analytics-db-helper/index.js (another sub-dependency):**
```js
import mysql from 'mysql2/promise';
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
