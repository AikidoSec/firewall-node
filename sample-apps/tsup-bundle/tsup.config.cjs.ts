import { cp, mkdir, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";

const outDir = "dist/cjs";

export default defineConfig({
  entry: ["src/app-cjs.ts"],
  bundle: true,
  platform: "node",
  format: ["cjs"],
  outDir,
  noExternal: [/.*/],
  clean: true,
  esbuildPlugins: [zenEsbuildPlugin()],
  onSuccess: async () => {
    await mkdir(`${outDir}/build/Release`, { recursive: true });

    await cp(
      "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
      `${outDir}/build/Release/better_sqlite3.node`
    );

    await writeFile(
      `${outDir}/package.json`,
      JSON.stringify({ type: "commonjs" }, null, 2)
    );
  },
});
