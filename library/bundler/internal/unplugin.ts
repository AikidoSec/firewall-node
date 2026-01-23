import { createUnplugin, type UnpluginInstance } from "unplugin";
import { patchPackage } from "../../agent/hooks/instrumentation/loadHook";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findZenLibPath } from "./findZenLibPath";
import { processEsbuildOptions } from "./bundlers/esbuild";
import { wrapInstalledPackages } from "../../agent/wrapInstalledPackages";
import { getWrappers } from "../../agent/protect";
import { copyFile, cp, mkdir } from "node:fs/promises";
import { processRolldownAndUpOptions } from "./bundlers/rolldownAndUp";
import { getModuleInfoFromPath } from "../../agent/hooks/getModuleInfoFromPath";
import { getPackageVersionFromPath } from "../../agent/hooks/instrumentation/getPackageVersionFromPath";
import { transformCodeInsertSCA } from "../../agent/hooks/instrumentation/transformCodeInsertSCA";

type UserOptions = {
  /**
   * Whether to copy the required files to the output directory.
   * In ESM builds, the entire module is copied, while for CJS builds, only the wasm files are copied.
   * @default true
   */
  copyFiles?: boolean;
};

export type OutputFormat = "cjs" | "esm";
export type BundlerProcessedOptions = {
  outdir: string;
  outputFormat: OutputFormat;
};

let importFound = false;
let userOptions: UserOptions | undefined = undefined;
let initialized = false;
let processedBundlerOpts: BundlerProcessedOptions | undefined = undefined;
const instrumentedForSCA = new Set<string>();

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

          const moduleInfo = getModuleInfoFromPath(id);
          if (!moduleInfo) {
            // In this case the file is not inside the node_modules folder
            return {
              code,
            };
          }

          const pkgVersion = getPackageVersionFromPath(moduleInfo.base);
          if (!pkgVersion) {
            // We don't instrument packages without a valid version
            return {
              code,
            };
          }

          const result = patchPackage(
            id,
            {
              source: code,
              format: "unambiguous",
              shortCircuit: false,
            },
            true, // Bundling mode
            moduleInfo, // Prevents double extraction of module info
            pkgVersion
          );

          let modifiedCode =
            typeof result.source === "string"
              ? result.source
              : new TextDecoder("utf-8").decode(result.source);

          // We use the base path of the module as unique identifier
          // The same package could be required from different locations with different versions
          if (!instrumentedForSCA.has(moduleInfo.base)) {
            instrumentedForSCA.add(moduleInfo.base);
            const insertSCAResult = transformCodeInsertSCA(
              moduleInfo.name,
              pkgVersion,
              moduleInfo.path,
              modifiedCode,
              "unambiguous"
            );

            modifiedCode = insertSCAResult ?? modifiedCode;
          }

          return {
            code: modifiedCode,
          };
        },
      },

      buildEnd: async () => {
        if (!processedBundlerOpts?.outputFormat) {
          throw new Error(
            "Aikido: Output format is undefined at build end. This is likely a bug in the bundler plugin."
          );
        }

        if (!processedBundlerOpts.outdir) {
          throw new Error(
            "Aikido: Output directory is undefined at build end. This is likely a bug in the bundler plugin."
          );
        }

        if (
          processedBundlerOpts.outputFormat === "esm" &&
          importFound === true
        ) {
          throw new Error(
            "Aikido: Detected import of '@aikidosec/firewall/instrument' in your code while building an ESM bundle. Please remove this import and preload the library by running Node.js with the --require option instead. See our ESM documentation for more information."
          );
        }

        if (
          processedBundlerOpts.outputFormat === "cjs" &&
          importFound === false
        ) {
          throw new Error(
            "Aikido: Missing import of '@aikidosec/firewall/instrument' in your code while building a CJS bundle. Please add this as the first line of your application's entry point file to ensure proper instrumentation."
          );
        }

        if (userOptions?.copyFiles !== false) {
          await copyFiles(
            processedBundlerOpts.outdir,
            processedBundlerOpts.outputFormat
          );
        }
      },

      esbuild: {
        config: (esbuildOptions) => {
          processedBundlerOpts = processEsbuildOptions(esbuildOptions);

          // Reset state on subsequent builds
          importFound = false;
        },
      },

      rolldown: {
        options: (rolldownOptions) => {
          processedBundlerOpts = processRolldownAndUpOptions(
            rolldownOptions,
            "rolldown"
          );

          // Reset state on subsequent builds
          importFound = false;
        },
      },
    };
  });

async function copyFiles(outDir: string, format: "cjs" | "esm") {
  const zenLibDir = findZenLibPath();

  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  if (format === "cjs") {
    // Copy only the wasm files into the output directory
    for (const file of [
      "node_code_instrumentation_bg.wasm",
      "zen_internals_bg.wasm",
    ]) {
      await copyFile(join(zenLibDir, file), join(outDir, file));
    }

    await cp(
      join(zenLibDir, "node_internals"),
      join(outDir, "node_internals"),
      {
        recursive: true,
      }
    );

    return;
  }

  // ESM: Copy the entire module into the output directory
  await cp(zenLibDir, join(outDir, "node_modules", "@aikidosec", "firewall"), {
    recursive: true,
  });
}
