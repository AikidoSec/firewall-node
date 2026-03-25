const { spawn } = require("child_process");
const { randomInt } = require("crypto");
const { setTimeout } = require("timers/promises");
const http = require("http");

const PORT_WITH_IDOR = 5010;
const PORT_WITHOUT_IDOR = 5011;
const WARMUP_REQUESTS = 1000;
const MEASURED_REQUESTS = 10000;

function percentile(arr, p) {
  const i = (arr.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
  });
}

async function measureRoute(port, path) {
  // Warmup
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    await get(port, typeof path === "function" ? path() : path);
  }

  // Measure
  const timings = [];
  for (let i = 0; i < MEASURED_REQUESTS; i++) {
    const url = typeof path === "function" ? path() : path;
    const start = performance.now();
    await get(port, url);
    timings.push(performance.now() - start);
  }

  timings.sort((a, b) => a - b);

  return {
    avg: timings.reduce((a, b) => a + b, 0) / timings.length,
    p50: percentile(timings, 0.5),
    p95: percentile(timings, 0.95),
    p99: percentile(timings, 0.99),
  };
}

function startServer(port, idorEnabled) {
  return spawn("node", ["app.js"], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_OPTIONS: "--require @aikidosec/firewall",
      AIKIDO_BLOCK: "true",
      IDOR_ENABLED: idorEnabled ? "true" : "false",
    },
    stdio: "inherit",
  });
}

function printComparison(label, withIdor, withoutIdor) {
  const diff = withIdor.p50 - withoutIdor.p50;
  const pct =
    withoutIdor.p50 > 0 ? ((diff / withoutIdor.p50) * 100).toFixed(1) : "N/A";

  console.log(`\n${label}`);
  console.log(
    `  Without IDOR  avg: ${withoutIdor.avg.toFixed(3)}ms  p50: ${withoutIdor.p50.toFixed(3)}ms  p95: ${withoutIdor.p95.toFixed(3)}ms  p99: ${withoutIdor.p99.toFixed(3)}ms`
  );
  console.log(
    `  With IDOR     avg: ${withIdor.avg.toFixed(3)}ms  p50: ${withIdor.p50.toFixed(3)}ms  p95: ${withIdor.p95.toFixed(3)}ms  p99: ${withIdor.p99.toFixed(3)}ms`
  );
  console.log(
    `  Overhead      p50: ${diff >= 0 ? "+" : ""}${diff.toFixed(3)}ms (${pct}%)`
  );
}

const routes = [
  { path: "/posts", label: "Cached query (parameterized SELECT)" },
  { path: "/posts-with-comments", label: "Cached query (parameterized JOIN)" },
  {
    path: () => `/posts/${randomInt(1_000_000)}`,
    label: "Unique query (inline ID, cache miss)",
  },
];

async function run() {
  console.log("Starting servers...");
  const procWith = startServer(PORT_WITH_IDOR, true);
  const procWithout = startServer(PORT_WITHOUT_IDOR, false);

  // Wait for servers + DB setup
  await setTimeout(3000);

  try {
    for (const route of routes) {
      const withIdor = await measureRoute(PORT_WITH_IDOR, route.path);
      const withoutIdor = await measureRoute(PORT_WITHOUT_IDOR, route.path);
      printComparison(route.label, withIdor, withoutIdor);
    }
  } finally {
    procWith.kill();
    procWithout.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
