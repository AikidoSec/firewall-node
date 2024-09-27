/**
 * Runs benchmarks for the api discovery (api schema collection)
 */
const { Routes } = require("../../build/agent/Routes");
const { isFeatureEnabled } = require("../../build/helpers/featureFlags");
const reqBodies = require("./reqBodies");

const MAX_TIME_LIMIT = 0.05; // milliseconds / statement
const RUN_COUNT = 100;

function main() {
  // Enable feature flag
  process.env.AIKIDO_FEATURE_COLLECT_API_SCHEMA = "true";
  if (!isFeatureEnabled("COLLECT_API_SCHEMA")) {
    console.error("Feature COLLECT_API_SCHEMA is not enabled!");
    process.exit(1);
  }

  const avgTime = getAvgBenchmark();
  if (avgTime > MAX_TIME_LIMIT) {
    console.error(
      `Average time it took for analyzing api route: ${avgTime}ms, this exceeds the allowed time of ${MAX_TIME_LIMIT}ms!`
    );
    process.exit(1);
  }
  console.info(`Average time it took for analyzing api route: ${avgTime}ms`);
  process.exit(0);
}

main();

function getContext(body) {
  return {
    method: "POST",
    route: "/test",
    headers: {
      "content-type": "application/json",
    },
    body,
    remoteAddress: "",
    url: "http://localhost/test",
    routeParams: {},
    query: {},
    cookies: {},
    source: "test",
  };
}

function runBenchmark(routes, body) {
  const context = getContext(body);
  const startTime = performance.now();
  routes.addRoute(context);
  const endTime = performance.now();
  return endTime - startTime;
}

/**
 * This function calculates the average time in ms / count of runs
 * @returns average time in milliseconds
 */
function getAvgBenchmark() {
  const routes = new Routes();
  let avgTime = 0;

  let bodyIndex = 0;
  for (let i = 0; i < RUN_COUNT; i++) {
    avgTime += runBenchmark(routes, reqBodies[bodyIndex]);
    if (bodyIndex === reqBodies.length - 1) {
      bodyIndex = 0;
    } else {
      bodyIndex++;
    }
  }

  avgTime = avgTime / RUN_COUNT;
  return avgTime;
}
