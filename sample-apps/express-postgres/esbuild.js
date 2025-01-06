const { build } = require("esbuild");
const { externals } = require("@aikidosec/firewall/bundler");

build({
  entryPoints: ["./app.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "./compiled.js",
  external: externals(),
});
