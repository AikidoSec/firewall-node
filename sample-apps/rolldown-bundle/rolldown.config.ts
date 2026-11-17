import { defineConfig, type OutputOptions } from "rolldown";
import { zenRolldownPlugin } from "@aikidosec/firewall/bundler";
import { cp } from "node:fs/promises";

const copyFilePlugin = () => ({
  name: "copy-files-plugin",
  async writeBundle(options: OutputOptions) {
    const outDir = options.dir;
    if (!outDir) {
      throw new Error("Output directory not specified");
    }

    await cp(
      "node_modules/sqlite3/build/Release/node_sqlite3.node",
      `${outDir}/build/node_sqlite3.node`
    );
  },
});

export default defineConfig([
  {
    input: "src/app-esm.ts",
    plugins: [zenRolldownPlugin(), copyFilePlugin()],
    platform: "node",
    output: {
      format: "esm",
      dir: "dist/esm",
    },
  },
  {
    input: "src/app-cjs.ts",
    plugins: [zenRolldownPlugin(), copyFilePlugin()],
    platform: "node",
    output: {
      format: "cjs",
      dir: "dist/cjs",
    },
  },
]);
