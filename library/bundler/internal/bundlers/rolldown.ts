import {
  type ProcessedBundlerOptions,
  type OutputFormat,
  type ZenBundlerPluginUserOptions,
  onBuildStart,
  onBuildEnd,
  transform,
  fileMatchRegex,
} from "../base";
import type {
  OutputOptions as RolldownOutputOptions,
  InputOptions as RolldownInputOptions,
  RolldownPlugin,
} from "rolldown";

// Plugin state
let externalizedZen = false; // If input options have not been processed, throw error in output options processing
let processedBundlerOpts: ProcessedBundlerOptions | undefined;

export function zenRolldownPlugin(
  userOptions?: ZenBundlerPluginUserOptions
): RolldownPlugin {
  return {
    name: "zen-rolldown-plugin",
    buildStart: () => {
      onBuildStart();
    },
    buildEnd: async () => {
      await onBuildEnd(processedBundlerOpts, userOptions);

      // Reset state for subsequent builds
      externalizedZen = false;
      processedBundlerOpts = undefined;
    },
    transform: {
      filter: {
        id: fileMatchRegex,
      },
      handler(code, id) {
        return transform(code, id);
      },
    },
    options: (rolldownOptions) => {
      processRolldownInputOptions(rolldownOptions, "rolldown");
      externalizedZen = true;
    },
    outputOptions: (outputOptions) => {
      if (!externalizedZen) {
        throw new Error(
          "Aikido: Zen library was not externalized in rolldown input options. This is probably a bug in the bundler plugin."
        );
      }

      processedBundlerOpts = processRolldownOutputOptions(
        outputOptions,
        "rolldown",
        userOptions
      );
    },
  };
}

export function processRolldownInputOptions(
  options: RolldownInputOptions & {
    output?: RolldownOutputOptions;
  },
  bundler: "rolldown" | "rollup"
): void {
  if (!options.external) {
    options.external = [/@aikidosec\/firewall.*/];
  } else if (Array.isArray(options.external)) {
    options.external.push(/@aikidosec\/firewall.*/);
  } else {
    throw new Error(
      `Aikido: ${bundler} external option needs to be an array or undefined.`
    );
  }
}

export function processRolldownOutputOptions(
  options: RolldownOutputOptions,
  bundler: "rolldown" | "rollup",
  userOptions: ZenBundlerPluginUserOptions | undefined
): ProcessedBundlerOptions {
  const outputFormat = getModuleFormat(options.format, bundler);

  if (!options?.dir && userOptions?.copyFiles !== false) {
    throw new Error(
      `Aikido: ${bundler} output directory is not specified. Please set the 'output.dir' option in your ${bundler} config.`
    );
  }

  return {
    outputFormat,
    outDir: options.dir,
  };
}

function getModuleFormat(
  format: RolldownOutputOptions["format"],
  bundler: "rolldown" | "rollup"
): OutputFormat {
  if (!format) {
    return "esm"; // Default to ESM if format is not specified
  }

  switch (format) {
    case "cjs":
    case "commonjs":
      return "cjs";
    case "esm":
    case "es":
    case "module":
      return "esm";
    default:
      throw new Error(
        `Aikido: ${bundler} output format is set to unsupported value '${format}'. Please set it to 'cjs' or 'esm'.`
      );
  }
}
