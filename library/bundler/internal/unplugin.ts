import { createUnplugin, type UnpluginInstance } from "unplugin";
import { protectDuringBundling } from "../../agent/protect";
import { patchPackage } from "../../agent/hooks/instrumentation/loadHook";
import { createRequire } from "node:module";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

type UserOptions = {
  execlude?: string | string[];
  inlineWebAssembly?: boolean;
};

let outputFormat: "cjs" | "esm" | undefined = undefined;

export const basePlugin: UnpluginInstance<UserOptions | undefined, false> =
  createUnplugin(() => {
    return {
      name: "zen-js-bundler-plugin",

      buildStart(options) {
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

          const modifiedCode =
            typeof result.source === "string"
              ? result.source
              : new TextDecoder("utf-8").decode(result.source);

          // Todo rewrite Zen imports in ESM mode but after code is processed by bundler?

          return {
            code: modifiedCode,
          };
        },
      },
      esbuild: {
        config: (options) => {
          if (!options.format) {
            // Todo We can try to determine the default format based on the platform (https://esbuild.github.io/api/#format) in the future
            throw new Error(
              "Aikido: esbuild output format is undefined. Please set it to 'cjs' or 'esm' explicitly in your esbuild config."
            );
          }

          if (options.format !== "cjs" && options.format !== "esm") {
            throw new Error(
              `Aikido: esbuild output format is set to unsupported value '${options.format}'. Please set it to 'cjs' or 'esm'.`
            );
          }

          outputFormat = options.format;

          // Todo not needed if bundle is false or packages are externalized

          // We only need to mark @aikidosec/firewall as external for ESM builds, as we need to preload it before any other ESM module is loaded
          if (outputFormat === "esm") {
            if (!options.external) {
              options.external = ["@aikidosec/firewall"];
            } else if (Array.isArray(options.external)) {
              options.external.push("@aikidosec/firewall");
            } else {
              throw new Error("esbuild external option is not an array");
            }
          }

          if (!options.outdir) {
            // Todo also support outfile if it contains a directory path?
            throw new Error(
              "Aikido: esbuild outdir is not set. Please set the outdir option in your esbuild config."
            );
          }

          copyFiles(options.outdir, options.format);

          return options;
        },
      },
    };
  });

function copyFiles(outDir: string, format: "cjs" | "esm") {
  const zenLibDir = findZenLibPath();

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  if (format === "cjs") {
    // Copy only the wasm files into the output directory
    for (const file of [
      "node_code_instrumentation_bg.wasm",
      "zen_internals_bg.wasm",
    ]) {
      copyFileSync(join(zenLibDir, file), join(outDir, file));
    }
  } else if (format === "esm") {
    cpSync(zenLibDir, join(outDir, "zen"), { recursive: true });
  }
}

function findZenLibPath(): string {
  // create a require function relative to current file
  const requireFunc = createRequire(__dirname);
  // resolve the library path
  return dirname(requireFunc.resolve("@aikidosec/firewall"));
}
