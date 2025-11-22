import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./index.ts",
    "./instrument/index.ts",
    "./instrument/internals.ts",
    "./context/index.ts",
    "./lambda/index.ts",
    "./nopp/index.ts",
    "./cloud-function/index.ts",
    "./bundler/index.ts",
    "./browser.ts",
    "./agent/hooks/instrumentation/zenHooksCheckImport.ts", // Keep for ESM self check
    "./agent/AgentSingleton.ts", // Keep for e2e test express-mysql.promises
  ],
  outDir: "../build",
  format: "cjs",
  sourcemap: true,
  platform: "node",
  tsconfig: "./tsconfig.build.json",
  inlineOnly: [],
  fixedExtension: false,
  unbundle: process.env.BUILD_KEEP_STRUCTURE === "true",
});
