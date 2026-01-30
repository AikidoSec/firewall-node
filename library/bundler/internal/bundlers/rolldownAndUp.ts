import type {
  ProcessedBundlerOptions,
  OutputFormat,
  ZenBundlerPluginUserOptions,
} from "../unplugin";
import type {
  OutputOptions as RolldownOutputOptions,
  InputOptions as RolldownInputOptions,
} from "rolldown";
import type {
  OutputOptions as RollupOutputOptions,
  InputOptions as RollupInputOptions,
} from "rollup";

export function processRolldownAndUpInputOptions(
  options:
    | (RolldownInputOptions & {
        output?: RolldownOutputOptions;
      })
    | (RollupInputOptions & {
        output?: RollupOutputOptions;
      }),
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

export function processRolldownAndUpOutputOptions(
  options: RolldownOutputOptions | RollupOutputOptions,
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
  format: RolldownOutputOptions["format"] | RollupOutputOptions["format"],
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
