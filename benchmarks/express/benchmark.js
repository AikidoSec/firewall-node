const { spawn } = require("child_process");
const { setTimeout } = require("timers/promises");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

// Accepted percentage of performance decrease
const AcceptedDecrease = 40; // %

function generateWrkCommandForUrl(url) {
  // Define the command with awk included
  return `wrk -t12 -c400 -d15s --latency ${url} | grep 'Requests/sec' | awk '{print $2}'`;
}

async function run() {
  console.log("Starting server with firewall...");
  const withFirewallProc = spawn("node", ["app.js"], {
    env: {
      ...process.env,
      PORT: 5001,
      NODE_OPTIONS: "--require @aikidosec/firewall",
      AIKIDO_BLOCK: "true",
    },
    stdio: "inherit",
  });

  // Wait 2 seconds for the server to start and settle
  await setTimeout(2000);

  // Run the benchmarks
  const withFirewallCommand = generateWrkCommandForUrl(
    "http://localhost:5001/empty"
  );
  const resultWithFirewall = await exec(withFirewallCommand);

  // Stop the server
  withFirewallProc.kill();

  console.log("Starting server without firewall...");

  const withoutFirewallProc = spawn("node", ["app.js"], {
    env: {
      ...process.env,
      PORT: 5002,
    },
    stdio: "inherit",
  });

  // Wait 2 seconds for the server to start and settle
  await setTimeout(2000);

  const withoutFirewallCommand = generateWrkCommandForUrl(
    "http://localhost:5002/empty"
  );

  const resultWithoutFirewall = await exec(withoutFirewallCommand);

  // Stop the server
  withoutFirewallProc.kill();

  console.log("Starting server with OpenTelemetry...");

  const withOpenTelemetryProc = spawn("node", ["app.js"], {
    env: {
      ...process.env,
      PORT: 5003,
      NODE_OPTIONS:
        "--require @opentelemetry/auto-instrumentations-node/register",
      OTEL_TRACES_EXPORTER: "none",
      OTEL_METRICS_EXPORTER: "none",
      OTEL_LOGS_EXPORTER: "none",
    },
    stdio: "inherit",
  });

  // Wait 2 seconds for the server to start and settle
  await setTimeout(2000);

  const resultWithOpenTelemetry = await exec(
    generateWrkCommandForUrl("http://localhost:5003/empty")
  );

  // Stop the server
  withOpenTelemetryProc.unref();
  withOpenTelemetryProc.kill();

  console.log("Starting server with Elastic APM...");

  const withElasticAPMProc = spawn("node", ["app.js"], {
    env: {
      ...process.env,
      PORT: 5004,
      NODE_OPTIONS: "--require elastic-apm-node/start",
      ELASTIC_APM_DISABLE_SEND: "true",
    },
    stdio: "inherit",
  });

  // Wait 2 seconds for the server to start and settle
  await setTimeout(2000);

  const resultWithElasticAPM = await exec(
    generateWrkCommandForUrl("http://localhost:5004/empty")
  );

  // Stop the server
  withElasticAPMProc.unref();
  withElasticAPMProc.kill();

  const withFirewall = parseFloat(resultWithFirewall.stdout.trim());
  const withoutFirewall = parseFloat(resultWithoutFirewall.stdout.trim());
  const withOpenTelemetry = parseFloat(resultWithOpenTelemetry.stdout.trim());
  const withElasticAPM = parseFloat(resultWithElasticAPM.stdout.trim());

  console.log("--- Results ---");
  console.log(`Without Zen: ${withoutFirewall} Requests/sec`);
  console.log(`With Zen: ${withFirewall} Requests/sec`);
  console.log(`With OpenTelemetry: ${withOpenTelemetry} Requests/sec`);
  console.log(`With Elastic APM: ${withElasticAPM} Requests/sec`);

  const increase = ((withoutFirewall - withFirewall) / withoutFirewall) * 100;
  console.log(`Decrease with Zen for an empty route: ${increase.toFixed(2)}%`);

  if (increase > AcceptedDecrease) {
    console.error(
      `Performance decrease is higher than the accepted ${AcceptedDecrease}%`
    );
    process.exit(1);
  }
}

run();
