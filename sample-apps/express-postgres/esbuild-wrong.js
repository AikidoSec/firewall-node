const { build } = require("esbuild");

build({
  entryPoints: ["./app.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "./compiled-bundled.js",
});
