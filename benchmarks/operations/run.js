const { runWithContext } = require("../../build/agent/Context");
const context = require("./context");

if (process.argv.length !== 4) {
  console.error("Usage: node run.js <module> true|false");
  process.exit(1);
}

const enableZen = process.argv[3] === "true";

if (enableZen) {
  process.env.AIKIDO_BLOCK = "true";
  require("@aikidosec/firewall");
}

const mod = require(`./${process.argv[2]}`);

(async () => {
  if (mod.setup) {
    await mod.setup();
  }

  if (!mod.step) {
    console.error("Module does not have a step function");
    process.exit(1);
  }

  // Warmup
  for (let i = 0; i < 2000; i++) {
    await mod.step();
  }

  const timings = [];
  async function steps() {
    for (let i = 0; i < 20000; i++) {
      const start = performance.now();
      await mod.step();
      const end = performance.now();
      timings.push(end - start);
    }
  }

  if (enableZen) {
    await runWithContext(context(), async () => {
      await steps();
    });
  } else {
    await steps();
  }

  if (mod.teardown) {
    await mod.teardown();
  }

  console.log(JSON.stringify(timings));
})();
