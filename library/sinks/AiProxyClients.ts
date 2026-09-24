import { Hooks } from "../agent/hooks/Hooks";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { createZenFetch } from "../ai_proxy/fetch";

/**
 * Pins the Anthropic and OpenAI SDK clients to the local AI proxy, so its L7
 * engine can see tool definitions/schemas and tool calls, and enforce
 * blocking.
 *
 * Overrides the SDK client's `fetch` (every version of both SDKs reads
 * `this.fetch` for every request, regardless of which internal transport
 * shim they otherwise default to) rather than `httpAgent`, whose semantics
 * differ across SDK versions depending on whether they use node-fetch or
 * native fetch internally.
 *
 * Only touches clients constructed with no `fetch` of their own. A caller
 * that supplies its own `fetch` is left untouched for now rather than risk
 * breaking their transport configuration.
 *
 * Patches the CJS build only; a caller that imports the SDK's real ESM build
 * directly gets an unpinned client (same fail-open fallback as an unhealthy
 * proxy) since the instrumentation here can't reassign live ESM bindings.
 */
export class AiProxyClients implements Wrapper {
  private pin(instance: any, constructorArgs: unknown[]) {
    const options = constructorArgs[0] as
      | { fetch?: unknown; apiKey?: string }
      | undefined;
    if (options?.fetch) {
      return;
    }

    const token = process.env.AIKIDO_TOKEN;
    if (!token) {
      return;
    }

    instance.fetch = createZenFetch(token);
  }

  wrap(hooks: Hooks) {
    const pinOpenAI = (exports: any, pkgInfo: PartialWrapPackageInfo) => {
      wrapNewInstance(exports, "OpenAI", pkgInfo, (instance, args) =>
        this.pin(instance, args)
      );
      wrapNewInstance(exports, "AzureOpenAI", pkgInfo, (instance, args) =>
        this.pin(instance, args)
      );
    };

    hooks
      .addPackage("openai")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0")
      .onRequire((exports, pkgInfo) => pinOpenAI(exports, pkgInfo))
      // onRequire only fires under old instrumentation; new instrumentation
      // needs addFileInstrumentation instead. index.js is every version's
      // main, so patching module.exports here after it finishes executing
      // covers both the direct-assignment and getter-re-export shapes.
      .addFileInstrumentation({
        path: "index.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => pinOpenAI(vars[0], pkgInfo),
        },
      });

    hooks
      .addPackage("@anthropic-ai/sdk")
      .withVersion("^0.20.0 || ^0.30.0 || ^0.40.0 || ^0.50.0 || ^0.56.0")
      .onRequire((exports, pkgInfo) => {
        // Unlike openai's `{ OpenAI, AzureOpenAI }` named exports, this
        // package's CJS export IS the Anthropic class itself -- must wrap
        // the default export, not a same-named property on it (that
        // property exists but is a distinct, never-constructed reference).
        return (
          wrapNewInstance(exports, undefined, pkgInfo, (instance, args) =>
            this.pin(instance, args)
          ) ?? exports
        );
      })
      // Same new-instrumentation gap as above; patched here instead of the
      // top-level export since that's a factory function, not an object
      // with a reassignable property. index.js re-reads Anthropic from
      // client.js on every access, so patching it here is visible everywhere.
      .addFileInstrumentation({
        path: "client.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => {
            wrapNewInstance(vars[0], "Anthropic", pkgInfo, (instance, args) =>
              this.pin(instance, args)
            );
          },
        },
      });
  }
}
