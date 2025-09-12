const { readFile, unlink } = require("fs/promises");
const { join } = require("path");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const spawn = require("child_process").spawn;

async function runBenchmarks() {
  console.log("Spawning servers...");

  let env = { ...process.env, AIKIDO_CI: "true" };

  const serverWithFirewall = spawn("node", ["server.js", "4000"], {
    env: {
      ...env,
      AIKIDO_BLOCKING: "true",
      NODE_OPTIONS: "-r @aikidosec/firewall",
    },
    cwd: join(__dirname, "app"),
  });

  const serverWithoutFirewall = spawn("node", ["server.js", "4001"], {
    env: {
      ...env,
    },
    cwd: join(__dirname, "app"),
  });

  try {
    for (const server of [serverWithFirewall, serverWithoutFirewall]) {
      server.on("error", (err) => {
        throw err;
      });

      server.stderr.on("data", (data) => {
        throw new Error(data.toString());
      });
    }

    console.log("Waiting for servers to start...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("Running k6...");
    const result = await exec("k6 run requests.mjs");
    if (result.stderr) {
      throw new Error(result.stderr);
    }

    serverWithFirewall.kill();
    serverWithoutFirewall.kill();
  } catch (error) {
    console.error(error);
    return false;
  } finally {
    serverWithFirewall.kill();
    serverWithoutFirewall.kill();
    return true;
  }
}

async function getResult() {
  const json = await readFile("result.json", "utf8");
  await unlink("result.json");
  return JSON.parse(json);
}

(async () => {
  // Check if k6 is installed
  try {
    await exec("k6 --version");
  } catch (error) {
    console.error(error);
    console.error(
      "k6 is not available. Please install k6 before running this benchmark."
    );
    console.error("https://grafana.com/docs/k6/latest/set-up/install-k6/");
    process.exit(1);
  }

  if (!(await runBenchmarks())) {
    process.exit(1);
  }

  const results = await getResult();

  console.log("====================================");
  console.log("Results with Zen enabled:");
  const getResultsWithZen = results.metrics.get_with_zen.values;
  console.log(
    `GET duration: avg=${getResultsWithZen.avg}ms, min=${getResultsWithZen.min}ms, max=${getResultsWithZen.max}ms`
  );
  const postResultsWithZen = results.metrics.post_with_zen.values;
  console.log(
    `POST duration: avg=${postResultsWithZen.avg}ms, min=${postResultsWithZen.min}ms, max=${postResultsWithZen.max}ms`
  );

  console.log("------------------------------------");
  console.log("Results with Zen disabled:");
  const getResultsWithoutZen = results.metrics.get_without_zen.values;
  console.log(
    `GET duration: avg=${getResultsWithoutZen.avg}ms, min=${getResultsWithoutZen.min}ms, max=${getResultsWithoutZen.max}ms`
  );
  const postResultsWithoutZen = results.metrics.post_without_zen.values;
  console.log(
    `POST duration: avg=${postResultsWithoutZen.avg}ms, min=${postResultsWithoutZen.min}ms, max=${postResultsWithoutZen.max}ms`
  );

  const getDiff = results.metrics.get_delta.values.avg;
  const postDiff = results.metrics.post_delta.values.avg;

  const getDiffPercent = (getDiff / getResultsWithoutZen.avg) * 100;
  const postDiffPercent = (postDiff / postResultsWithoutZen.avg) * 100;

  console.log("------------------------------------");
  console.log("Zen performance impact:");
  console.log(
    `GET avg diff: ${getDiff.toFixed(3)}ms (${getDiffPercent.toFixed(2)}%)`
  );
  console.log(
    `POST avg diff: ${postDiff.toFixed(3)}ms (${postDiffPercent.toFixed(2)}%)`
  );

  // Check if difference is larger than 5ms
  if (getDiff > 5 || postDiff > 5) {
    console.log("Zen is causing a performance impact thats larger than 5ms");
    process.exit(1);
  }

  console.log("Test passed successfully, no significant performance impact.");
  process.exit(0);
})();
