# Troubleshooting

## Review installation steps

Double-check your setup against the [installation guide](../README.md#installation).  
Make sure:

- The package installed correctly.
- The firewall is imported early in your app (before any other import).
- Your framework-specific integration (middleware, decorator, etc.) matches the example in the README.
- You’re using Node.js 16 or newer.
- Zen runs only on the server side, it does not run in the browser.

## Check connection to Aikido

The firewall must be able to reach Aikido’s API endpoints.

Test from the same environment where your app runs and follow the instructions on this page: https://help.aikido.dev/zen-firewall/miscellaneous/outbound-network-connections-for-zen

## Check logs for errors

Common places:

- Docker: `docker logs <your-app-container>`
- systemd: `journalctl -u <your-app-service> --since "1 hour ago"`
- Local dev: your terminal or IDE run console

Tip: search for lines that contain `Aikido` or `Zen` to spot initialization and request logs.

## Enable debug logging

Set the environment variable `AIKIDO_DEBUG` to `true` and check the log output of your application.

You should see the message `AIKIDO: Starting agent vX.X.X`.

In addition the output contains the name and version of each supported and instrumented library or framework in the format `library@version is supported!`. Please ensure that the logs contain these message at least for your web framework (e.g. express) and your database driver.

## Bundlers & ECMAScript modules (ESM)

If you are using a bundler like esbuild or a framework that uses bundling please ensure to follow the steps described in the [bundler](./bundler.md) docs. If your application uses native ESM at runtime, see [ESM setup](./esm.md). Note that many TypeScript projects use `import` syntax but still compile to CommonJS — in that case no extra steps are needed.

## Disable code generation hook

Zen uses a native addon to protect against code injection via `eval()` and `new Function()`. In the rare case that you experience fatal V8 errors, you can disable it:

```bash
AIKIDO_DISABLE_CODE_GENERATION_HOOK=true node server.js
```

## Contact support

If you still can’t resolve the issue:

- Use the [in-app chat](https://app.aikido.dev/) to reach our support team directly.
- Or create an issue on [GitHub](https://github.com/AikidoSec/firewall-node/issues) with details about your setup, framework, and logs.

Include as much context as possible (framework, logs, and how Aikido was added) so we can help you quickly.
