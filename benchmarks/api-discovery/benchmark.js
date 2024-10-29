/**
 * Runs benchmarks for the api discovery (api schema collection)
 */
const { Routes } = require("../../build/agent/Routes");
const { isFeatureEnabled } = require("../../build/helpers/featureFlags");
const reqBodies = require("./reqBodies");
const headers = require("./headers");
const queryParameters = require("./queryParameters");
const cookies = require("./cookies");

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

function getContext(body, headers, query, cookies) {
  return {
    method: "POST",
    route: "/test",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body,
    remoteAddress: "",
    url: "http://localhost/test",
    routeParams: {},
    query: query,
    cookies: cookies,
    source: "test",
  };
}

function runBenchmark(routes, body, headers, query, cookies) {
  const context = getContext(body, headers, query, cookies);
  const startTime = performance.now();
  routes.addRoute(context);
  const endTime = performance.now();
  return endTime - startTime;
}

function nextIndex(index, length) {
  return index === length - 1 ? 0 : index + 1;
}

/**
 * This function calculates the average time in ms / count of runs
 * @returns average time in milliseconds
 */
function getAvgBenchmark() {
  const routes = new Routes();
  let avgTime = 0;

  let bodyIndex = 0;
  let headersIndex = 0;
  let queryIndex = 0;
  let cookieIndex = 0;
  for (let i = 0; i < RUN_COUNT; i++) {
    avgTime += runBenchmark(
      routes,
      reqBodies[bodyIndex],
      headers[headersIndex],
      queryParameters[queryIndex],
      cookies[cookieIndex]
    );
    bodyIndex = nextIndex(bodyIndex, reqBodies.length);
    headersIndex = nextIndex(headersIndex, headers.length);
    queryIndex = nextIndex(queryIndex, queryParameters.length);
    cookieIndex = nextIndex(cookieIndex, cookies.length);
  }

  avgTime = avgTime / RUN_COUNT;
  return avgTime;
}
