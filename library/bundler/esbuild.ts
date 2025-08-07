import type { OnLoadArgs, OnLoadResult, Plugin, PluginBuild } from "esbuild";
import { patchPackage } from "../agent/hooks/instrumentation/loadHook";
import { copyFile, readFile } from "fs/promises";
import { protectDuringBundling } from "../agent/protect";
import { basename, dirname, join } from "path";

export const zenEsbuildPlugin: Plugin = {
  name: "@aikidosec/firewall",
  async setup(build) {
    const isBundlingPackages =
      build.initialOptions.bundle &&
      build.initialOptions.packages !== "external";

    if (!isBundlingPackages) {
      return;
    }
    const outDir = getOutDir(build);

    await copyWasmFiles(outDir);

    protectDuringBundling();

    build.onLoad({ filter: /\.(js|mjs|cjs|jsx)$/, namespace: "file" }, onLoad);
  },
};

async function onLoad(args: OnLoadArgs): Promise<OnLoadResult> {
  try {
    const fileContent = await readFile(args.path, "utf-8");
    const result = patchPackage(args.path, {
      source: fileContent,
      format: "unambiguous",
      shortCircuit: false,
    });

    if (typeof result.source !== "string") {
      result.source = new TextDecoder("utf-8").decode(result.source);
    }

    return {
      contents: result.source,
    };
  } catch (error) {
    return {
      errors: [
        {
          text: `Failed to patch package at ${args.path}: ${String(error)}`,
        },
      ],
    };
  }
}

function getOutDir(build: PluginBuild): string {
  const outdir = build.initialOptions.outdir;
  const outfile = build.initialOptions.outfile;

  // Pick destination dir (support both outfile & outdir)
  const outDirResolved = outdir ?? (outfile ? dirname(outfile) : null);
  if (!outDirResolved) {
    throw new Error(
      "Zen esbuild plugin requires either 'outdir' or 'outfile' to be set in the build options."
    );
  }

  return outDirResolved;
}

async function copyWasmFiles(outDir: string): Promise<void> {
  const zenLibDir = dirname(require.resolve("@aikidosec/firewall"));

  const wasmFiles = [
    join(zenLibDir, "internals", "zen_internals_bg.wasm"),
    join(
      zenLibDir,
      "agent",
      "hooks",
      "instrumentation",
      "wasm",
      "node_code_instrumentation_bg.wasm"
    ),
  ];

  await Promise.all(
    wasmFiles.map((file) => copyFile(file, join(outDir, basename(file))))
  );
}
