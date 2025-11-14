import { createUnplugin, type UnpluginInstance } from "unplugin";
import { protectDuringBundling } from "../../agent/protect";
import { patchPackage } from "../../agent/hooks/instrumentation/loadHook";
import { createRequire } from "node:module";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

type UserOptions = {
  /**
   * Whether to copy Zen to the output directory for ESM builds.
   */
  copyModule: boolean;
};

let outputFormat: "cjs" | "esm" | undefined = undefined;
let importFound = false;
let userOptions: UserOptions | undefined = undefined;

export const basePlugin: UnpluginInstance<UserOptions | undefined, false> =
  createUnplugin((options) => {
    userOptions = options;

    return {
      name: "zen-js-bundler-plugin",

      buildStart: () => {
        protectDuringBundling();
      },

      transform: {
        filter: {
          id: /\.(js|ts|cjs|mjs|jsx|tsx)$/,
        },
        handler(code, id) {
          // Check whether the instrumentation import is present in the user's code
          // The import is required in CJS builds but forbidden in ESM builds
          if (
            !importFound &&
            !id.includes("node_modules") &&
            // We need to ignore imports of instrument/internals from within the library itself
            // As the lib is not inside the node_modules folder during unit and e2e tests
            (code.includes("@aikidosec/firewall/instrument'") ||
              code.includes('@aikidosec/firewall/instrument"'))
          ) {
            importFound = true;
          }

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

          return {
            code: modifiedCode,
          };
        },
      },

      buildEnd: () => {
        if (outputFormat === "esm" && importFound === true) {
          throw new Error(
            "Aikido: Detected import of '@aikidosec/firewall/instrument' in your code while building an ESM bundle. Please remove this import and preload the library by running Node.js with the --require option instead. See our ESM documentation for more information."
          );
        }

        if (outputFormat === "cjs" && importFound === false) {
          throw new Error(
            "Aikido: Missing import of '@aikidosec/firewall/instrument' in your code while building a CJS bundle. Please add this as the first line of your application's entry point file to ensure proper instrumentation."
          );
        }
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

            const injectPath = join(
              findZenLibPath(),
              "bundler",
              "internal",
              "shim.mjs"
            );
            if (!options.inject) {
              options.inject = [injectPath];
            } else if (Array.isArray(options.inject)) {
              options.inject.push(injectPath);
            } else {
              throw new Error("esbuild inject option is not an array");
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
  } else if (format === "esm" && userOptions?.copyModule !== false) {
    cpSync(zenLibDir, join(outDir, "node_modules", "@aikidosec", "firewall"), {
      recursive: true,
    });
  }
}

function findZenLibPath(): string {
  // create a require function relative to current file
  const requireFunc = createRequire(__dirname);
  // resolve the library path
  return dirname(requireFunc.resolve("@aikidosec/firewall"));
}
