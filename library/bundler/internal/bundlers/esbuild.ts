import type { BuildOptions } from "esbuild";
import type { BundlerProcessedOptions } from "../unplugin";
import { findZenLibPath } from "../findZenLibPath";
import { join } from "node:path";

export function processEsbuildOptions(
  options: BuildOptions
): BundlerProcessedOptions {
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

  const outputFormat = options.format;

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

  return {
    outputFormat,
    outdir: options.outdir,
  };
}
