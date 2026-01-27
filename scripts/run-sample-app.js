const { exec } = require("child_process");
const { fileExists } = require("./helpers/fs");
const { resolve } = require("path");

const sampleAppsDir = resolve(__dirname, "..", "sample-apps");

async function runApp(appName, command, dir, envs = {}) {
  if (!(await fileExists(dir))) {
    console.error(`Sample App "${appName}" not found`);
    process.exit(1);
  }

  console.log(`Running Sample App "${appName}"`);
  const appProcess = exec(command, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...envs,
      AIKIDO_DEBUG: true,
      AIKIDO_BLOCKING: true,
    },
    cwd: dir,
  });

  appProcess.stdout.pipe(process.stdout);
  appProcess.stderr.pipe(process.stderr);

  appProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Sample App "${appName}" exited with code ${code}`);
    }
  });
}

const defaultCmd = "node app.js";

// Apps with non default configurations
const specialApps = {
  micro: {
    command: "node --require @aikidosec/firewall ./node_modules/.bin/micro",
  },
  "lambda-mongodb-nosql-injection": {
    command:
      "npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/nosql-injection-request.json",
    dir: "lambda-mongodb",
  },
  "lambda-mongodb-safe": {
    command:
      "npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/safe-request.json",
    dir: "lambda-mongodb",
  },
  "nestjs-sentry": {
    command: "npm run start",
  },
  "nestjs-fastify": {
    command: "npm run start",
  },
  "functions-framework-sqlite3": {
    command: "npx functions-framework",
  },
  "react-router-pg": {
    command: "npm run start",
  },
};

if (process.argv.length < 3) {
  console.error("Usage: npm run sample-app <app-name>");
  process.exit(1);
}

const appName = process.argv[2];
const app = specialApps[appName] || { command: defaultCmd };

runApp(appName, app.command, `${sampleAppsDir}/${app.dir || appName}`);
