# Graceful shutdown

When your app shuts down, Zen might not have sent its latest stats to the server yet. Call `await Zen.shutdown()` before exiting to make sure nothing gets lost.

If you already have a shutdown handler (like `process.on('SIGTERM', ...)`), add `await Zen.shutdown()` to it.

If you don't have one yet:

```js
const Zen = require("@aikidosec/firewall");

async function onShutdown() {
  await Zen.shutdown();
  process.exit(process.exitCode || 0);
}

process.on("SIGTERM", onShutdown);
process.on("SIGINT", onShutdown);
```

`SIGTERM` is the signal sent by most process managers (Docker, Kubernetes, systemd) when stopping your app. `SIGINT` fires when you press Ctrl+C.

The `process.exit()` call is needed because Node.js [no longer exits by default](https://nodejs.org/api/process.html#signal-events) once you install a signal listener.

`Zen.shutdown()` accepts an optional timeout in milliseconds (default: 1000). If flushing stats takes longer than the timeout, it gives up and lets the process exit.
