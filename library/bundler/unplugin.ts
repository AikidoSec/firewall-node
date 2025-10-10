import { createUnplugin, type UnpluginInstance } from "unplugin";
import { protectDuringBundling } from "../agent/protect";
import { patchPackage } from "../agent/hooks/instrumentation/loadHook";

type UserOptions = {
  execlude?: string | string[];
  inlineWebAssembly?: boolean;
};

export const basePlugin: UnpluginInstance<UserOptions | undefined, false> =
  createUnplugin(() => {
    return {
      name: "zen-js-bundler-plugin",

      buildStart() {
        protectDuringBundling();
      },

      transform: {
        filter: {
          id: /\.(js|ts|cjs|mjs|jsx|tsx)$/,
        },
        handler(code, id) {
          const result = patchPackage(id, {
            source: code,
            format: "unambiguous",
            shortCircuit: false,
          });

          // Todo fix SCA not reporting packages patched during bundling

          if (typeof result.source !== "string") {
            return {
              code: new TextDecoder("utf-8").decode(result.source),
            };
          }

          return {
            code: result.source,
          };
        },
      },
      esbuild: {
        config: (options) => {
          if (!options.external) {
            options.external = ["@aikidosec/firewall"];
          } else if (Array.isArray(options.external)) {
            options.external.push("@aikidosec/firewall");
          } else {
            throw new Error("esbuild external option is not an array");
          }
        },
      },
    };
  });
