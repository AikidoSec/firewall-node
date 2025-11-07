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
  ],
  outDir: "../build",
  format: "cjs",
  sourcemap: true,
  platform: "node",
  tsconfig: "./tsconfig.build.json",
});
