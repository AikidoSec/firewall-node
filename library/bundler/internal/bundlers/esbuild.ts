import type {
  BuildOptions,
  Plugin as EsbuildPlugin,
  OnLoadArgs,
  OnLoadResult,
} from "esbuild";
import {
  fileMatchRegex,
  onBuildEnd,
  onBuildStart,
  transform,
  type ProcessedBundlerOptions,
  type ZenBundlerPluginUserOptions,
} from "../base";
import { findZenLibPath } from "../findZenLibPath";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

let processedBundlerOpts: ProcessedBundlerOptions | undefined;

export function zenEsbuildPlugin(
  userOptions?: ZenBundlerPluginUserOptions
): EsbuildPlugin {
  return {
    name: "zen-esbuild-plugin",
    setup(build) {
      processedBundlerOpts = processEsbuildOptions(
        build.initialOptions,
        userOptions
      );

      build.onStart(onBuildStart);
      build.onEnd(async () => {
        await onBuildEnd(processedBundlerOpts, userOptions);
      });

      build.onLoad({ filter: fileMatchRegex, namespace: "file" }, onLoad);
    },
  };
}

async function onLoad(args: OnLoadArgs): Promise<OnLoadResult> {
  // noopengrep
  const fileContent = await readFile(args.path, "utf-8");

  const result = transform(fileContent, args.path);

  return {
    contents: result.code,
    // Esbuild stops auto-detecting the loader based on file extension
    // and tries to parse TS files as JS etc. which can lead to errors.
    loader: getLoaderFromFilePath(args.path),
  };
}

export function processEsbuildOptions(
  options: BuildOptions,
  userOptions: ZenBundlerPluginUserOptions | undefined
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
    throw new Error(
      "Aikido: esbuild external option needs to be an array or undefined."
    );
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
      throw new Error("Aikido: esbuild inject option is not an array");
    }
  }

  if (!options.outdir && userOptions?.copyFiles !== false) {
    throw new Error(
      "Aikido: esbuild outdir is not set. Please set the outdir option in your esbuild config."
    );
  }

  return {
    outputFormat,
    outDir: options.outdir,
  };
}

function getLoaderFromFilePath(path: string): OnLoadResult["loader"] {
  const extension = path.split(".").pop();

  switch (extension) {
    case "js":
    case "cjs":
    case "mjs": {
      return "js";
    }
    case "ts":
    case "mts":
    case "cts": {
      return "ts";
    }
    case "tsx":
    case "jsx": {
      return extension;
    }
    default: {
      return "default";
    }
  }
}
