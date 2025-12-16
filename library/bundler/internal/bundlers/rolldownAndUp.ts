import type { BundlerProcessedOptions, OutputFormat } from "../unplugin";
import type {
  OutputOptions as RolldownOutputOptions,
  InputOptions as RolldownInputOptions,
} from "rolldown";
import type {
  OutputOptions as RollupOutputOptions,
  InputOptions as RollupInputOptions,
} from "rollup";

export function processRolldownAndUpOptions(
  options:
    | (RolldownInputOptions & {
        output?: RolldownOutputOptions;
      })
    | (RollupInputOptions & {
        output?: RollupOutputOptions;
      })
): BundlerProcessedOptions {
  const outputFormat = getModuleFormat(options.output?.format);

  // Todo detect cases where bundling is not enabled and throw an error

  // Todo
}

function getModuleFormat(
  format: RolldownOutputOptions["format"] | RollupOutputOptions["format"]
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
        `Aikido: rolldown/rollup output format is set to unsupported value '${format}'. Please set it to 'cjs' or 'esm'.`
      );
  }
}
