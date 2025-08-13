import * as esbuild from "esbuild";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler/esbuild";

await esbuild.build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/app.js",
  plugins: [zenEsbuildPlugin],
});
