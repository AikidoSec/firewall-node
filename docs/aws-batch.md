# AWS Batch

AWS Batch runs scripts in containers — there's no HTTP server involved. Zen can still track AI token usage (Bedrock, OpenAI, etc.) inside your batch jobs.

At the very beginning of your script, add the following line:

```js
const Zen = require("@aikidosec/firewall"); // <-- Include this before any other code or imports

async function main() {
  // Your batch job logic
}

main()
  .catch(console.error)
  .finally(() => Zen.shutdown());
```

or using `import` syntax:

```js
import Zen from "@aikidosec/firewall";

async function main() {
  // Your batch job logic
}

main()
  .catch(console.error)
  .finally(() => Zen.shutdown());
```

> [!NOTE]
> Many TypeScript projects use `import` syntax but still compile to CommonJS — in that case, the setup above works as-is. If your app runs as **native ESM** at runtime (e.g. `"type": "module"` in package.json), see [ESM setup](./esm.md) for additional steps.

The `Zen.shutdown()` call at the end makes sure all collected stats are sent before the process exits. See [graceful shutdown](./graceful-shutdown.md) for more details.

## Debug mode

If you need to debug the firewall, you can run your batch job with the environment variable `AIKIDO_DEBUG` set to `true`.

This will output debug information to the console (e.g. if the agent failed to start, no token was found, unsupported packages, ...).
