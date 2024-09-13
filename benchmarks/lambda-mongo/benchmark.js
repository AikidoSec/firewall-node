const { resolve } = require("path");
const { promisify } = require("util");
const { spawn } = require("child_process");
const { setTimeout } = require("timers/promises");
const { exec } = require("child_process");
const { writeFile } = require("fs/promises");
const execAsync = promisify(exec);

const directory = resolve(__dirname);

async function setupEnvironment() {
  // Convert symlinked dir node_modules/@aikidosec/firewall to normal dir
  await execAsync("mkdir -p node_modules/@aikidosec/firewall-nosymlink");
  await execAsync(
    "cp -r node_modules/@aikidosec/firewall/* node_modules/@aikidosec/firewall-nosymlink/"
  );
}

async function sendRequest(safeRequest = true) {
  const body = {
    username: "hans@aikido.dev",
    password: "password",
  };
  if (!safeRequest) {
    body.password = { $gt: "" };
  }

  const response = await fetch("http://127.0.0.1:4000/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (safeRequest && !response.ok) {
    throw new Error("Request should have succeeded");
  }

  if (!safeRequest && response.ok) {
    throw new Error("Request should have failed");
  }
}

async function runBenchmark(
  disableFirewall = false,
  setToken = false,
  runs = 200
) {
  console.log("------------------------");

  const env = {
    AIKIDO_BLOCK: "true",
    AIKIDO_CI: "true",
    AIKIDO_DEBUG: "true",
  };

  if (disableFirewall) {
    env.LAMBDA_TEST_DISABLE_FIREWALL = "true";
  }

  if (setToken) {
    env.AIKIDO_TOKEN = "test";
  }

  // Write env to .env file
  const envFile = resolve(directory, ".env");
  let envContent = "";
  for (const [key, value] of Object.entries(env)) {
    envContent += `${key}=${value}\n`;
  }
  await writeFile(envFile, envContent);

  const cmd = "npx sls offline";

  const proc = spawn(cmd, {
    cwd: directory,
    shell: true,
  });

  // Wait for the server to start
  await new Promise((resolve) => {
    proc.stderr.on("data", (data) => {
      console.log(data.toString());
      if (data.toString().includes("Server ready")) {
        resolve();
      }
    });
  });
  await setTimeout(500); // Let the server settle

  proc.on("error", (err) => {
    console.error(err);
  });

  // Some output that is not a error goes to stderr
  let out = "";
  proc.stdout.on("data", (data) => {
    out += data;
  });
  proc.stderr.on("data", (data) => {
    out += data;
  });

  // Sent http request to the server
  for (let i = 0; i < runs; i++) {
    await sendRequest();
  }

  // Stop the server
  proc.kill();

  // Extract all durations from the output
  const durations = out.match(
    /^.*REPORT RequestId.*Duration:\s(\d+(\.\d+)?)\sms.*$/gm
  );
  // Remove first element (warmup)
  durations.shift();
  // Sum all durations
  const sum = durations.reduce((acc, val) => {
    const duration = parseFloat(val.match(/(\d+\.\d+)/)[0]);
    return acc + duration;
  }, 0);

  const avg = sum / (runs - 1);
  console.log(`Average duration: ${avg}ms`);

  return avg;
}

async function main() {
  await setupEnvironment();

  const withoutFirewall = await runBenchmark(true, false);
  const withFirewall = await runBenchmark(true, false);
  const withFirewallAndReporting = await runBenchmark(true, true);

  await setTimeout(500); // To ensure that our logs are printed at the end (after container is stopped)

  const withFirewallDiff = withFirewall - withoutFirewall;
  const withFirewallAndReportingDiff =
    withFirewallAndReporting - withoutFirewall;

  console.log("------------------------");
  console.log(
    `Avg difference with firewall: ${withFirewallDiff.toFixed(2)}ms (${((withFirewallDiff / withoutFirewall) * 100).toFixed(2)}%)`
  );
  console.log(
    `Difference with firewall and reporting: ${withFirewallAndReportingDiff.toFixed(2)}ms (${((withFirewallAndReportingDiff / withoutFirewall) * 100).toFixed(2)}%)`
  );
}

main();
