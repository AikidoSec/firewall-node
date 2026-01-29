import type { BuildOptions } from "esbuild";
import type { ProcessedBundlerOptions } from "../unplugin";
import { findZenLibPath } from "../findZenLibPath";
import { join } from "node:path";

export function processEsbuildOptions(
  options: BuildOptions
): ProcessedBundlerOptions {
  if (!options.format) {
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

  if (!options.bundle) {
    throw new Error(
      "Aikido: esbuild bundling is not enabled. You do not need to use the Aikido esbuild plugin if you are not bundling your application. Please remove the plugin from your esbuild config."
    );
  }

  if (options.packages === "external") {
    throw new Error(
      "Aikido: esbuild 'packages' option is set to 'external'. You do not need to use the Aikido esbuild plugin if you are externalizing all packages. Please remove the plugin from your esbuild config."
    );
  }

  if (!options.external) {
    options.external = ["@aikidosec/firewall"];
  } else if (Array.isArray(options.external)) {
    if (!options.external.includes("@aikidosec/firewall")) {
      options.external.push("@aikidosec/firewall");
    }
  } else {
    throw new Error("esbuild external option is not an array");
  }

  if (outputFormat === "esm") {
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
    throw new Error(
      "Aikido: esbuild outdir is not set. Please set the outdir option in your esbuild config."
    );
  }

  return {
    outputFormat,
    outDir: options.outdir,
  };
}
