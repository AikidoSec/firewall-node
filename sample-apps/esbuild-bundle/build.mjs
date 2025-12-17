import * as esbuild from "esbuild";
import { zenEsbuildPlugin } from "@aikidosec/firewall/bundler";
import { cp, rm, writeFile } from "fs/promises";

await rm("./build", { recursive: true, force: true });

const buildMatrix = [
  {
    format: "cjs",
  },
  {
    format: "esm",
  },
];

for (const buildConfig of buildMatrix) {
  const appPath = `src/app-${buildConfig.format}.ts`;
  const outdir = `./build/${buildConfig.format}`;

  await esbuild.build({
    entryPoints: [appPath],
    bundle: true,
    platform: "node",
    format: buildConfig.format,
    outdir: outdir,
    plugins: [zenEsbuildPlugin()],
  });

  await cp(
    "node_modules/sqlite3/build/Release/node_sqlite3.node",
    `${outdir}/build/node_sqlite3.node`
  );

  await writeFile(
    `${outdir}/package.json`,
    JSON.stringify(
      { type: buildConfig.format === "esm" ? "module" : "commonjs" },
      null,
      2
    )
  );
}
