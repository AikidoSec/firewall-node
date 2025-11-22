import * as esbuild from "esbuild";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";
import { cp, rm, writeFile } from "fs/promises";

const format = process.env.BUNDLE_FORMAT || "cjs";
const appPath = process.env.APP_PATH || `src/app-${format}.ts`;

await rm("./build", { recursive: true, force: true });

await esbuild.build({
  entryPoints: [appPath],
  bundle: true,
  platform: "node",
  format: format,
  outdir: "./build",
  plugins: [zenEsbuildPlugin()],
});

await cp(
  "node_modules/sqlite3/build/Release/node_sqlite3.node",
  format === "esm" ? "build/build/node_sqlite3.node" : "build/node_sqlite3.node" // Todo: Understand why it searches in different dir for ESM
);

if (format === "esm") {
  await writeFile(
    "build/package.json",
    JSON.stringify({ type: "module" }, null, 2)
  );
}
