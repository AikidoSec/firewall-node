import { defineConfig } from "rolldown";
import { zenRolldownPlugin } from "@aikidosec/firewall/bundler";

export default defineConfig([
  {
    input: "src/app-esm.js",
    plugins: [zenRolldownPlugin()],
    platform: "node",
    output: {
      format: "esm",
      dir: "dist/esm",
    },
  },
  {
    input: "src/app-cjs.js",
    plugins: [zenRolldownPlugin()],
    platform: "node",
    output: {
      format: "cjs",
      dir: "dist/cjs",
    },
  },
]);
