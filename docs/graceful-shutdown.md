# Graceful Shutdown

If you already registered a shutdown handler, e.g. using `process.on('SIGTERM', ...)`, you can call `await Zen.shutdown()` to ensure the latest stats are sent before the process exits.
See the example below for how to implement this, if you don't already have a shutdown handler in place.
Please note that this might not work correctly in all environments, especially on Windows.

```js
const Zen = require("@aikidosec/firewall");

async function shutdownHandler() {
  // Perform any cleanup or final tasks here
  await Zen.shutdown();

  process.exit(process.exitCode || 0);
}

process.on("SIGTERM", shutdownHandler);
process.on("SIGINT", shutdownHandler);
// Handle other signals as needed
```
