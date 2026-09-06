import { Hooks } from "../agent/hooks/Hooks";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
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
 */
export class AiProxyClients implements Wrapper {
  private pin(instance: any, constructorArgs: unknown[]) {
    const options = constructorArgs[0] as { fetch?: unknown; apiKey?: string } | undefined;
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
    hooks
      .addPackage("openai")
      .withVersion("^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "OpenAI", pkgInfo, (instance, args) =>
          this.pin(instance, args)
        );
        wrapNewInstance(exports, "AzureOpenAI", pkgInfo, (instance, args) =>
          this.pin(instance, args)
        );
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
      });
  }
}
