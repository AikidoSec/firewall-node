import * as esbuild from "esbuild";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";
import { cp } from "fs/promises";

await esbuild.build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "build/app.js",
  plugins: [zenEsbuildPlugin()],
});

await cp(
  "node_modules/sqlite3/build/Release/node_sqlite3.node",
  "build/node_sqlite3.node"
);
