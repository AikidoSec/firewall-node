import { createUnplugin, type UnpluginInstance } from "unplugin";
import { patchPackage } from "../../agent/hooks/instrumentation/loadHook";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findZenLibPath } from "./findZenLibPath";
import { processEsbuildOptions } from "./bundlers/esbuild";
import { wrapInstalledPackages } from "../../agent/wrapInstalledPackages";
import { getWrappers } from "../../agent/protect";

type UserOptions = {
  /**
   * Whether to copy Zen to the output directory for ESM builds.
   */
  copyModule: boolean;
};

export type OutputFormat = "cjs" | "esm";
export type BundlerProcessedOptions = {
  outdir: string;
  outputFormat: OutputFormat;
};

let outputFormat: OutputFormat | undefined = undefined;
let importFound = false;
let userOptions: UserOptions | undefined = undefined;
let outdir: string | undefined = undefined;
let initialized = false;

export const basePlugin: UnpluginInstance<UserOptions | undefined, false> =
  createUnplugin((options) => {
    userOptions = options;

    return {
      name: "zen-js-bundler-plugin",

      buildStart: () => {
        if (!initialized) {
          initialized = true;

          // On first execution of bundler plugin
          wrapInstalledPackages(
            getWrappers(),
            true, // Use new instrumentation during bundling
            undefined, // serverless
            true // Is bundling process
          );

          return;
        }
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
        if (!outputFormat) {
          throw new Error(
            "Aikido: Output format is undefined at build end. This is likely a bug in the bundler plugin."
          );
        }

        if (!outdir) {
          throw new Error(
            "Aikido: Output directory is undefined at build end. This is likely a bug in the bundler plugin."
          );
        }

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

        copyFiles(outdir, outputFormat);
      },

      esbuild: {
        config: (options) => {
          ({ outputFormat, outdir } = processEsbuildOptions(options));

          // Reset state on subsequent builds
          importFound = false;
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
