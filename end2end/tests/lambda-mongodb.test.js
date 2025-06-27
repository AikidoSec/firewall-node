const t = require("tap");
const { resolve } = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

const getJsonFromLogs = (logs) => {
  const lines = logs.split("\n");
  const startIndex = lines.findIndex((line) => line.trim().startsWith("{"));
  if (startIndex === -1) {
    throw new Error("No JSON object found in logs");
  }
  return JSON.parse(lines.slice(startIndex).join("\n"));
};

const directory = resolve(__dirname, "../../sample-apps/lambda-mongodb");

// Invoking serverless functions can be slow
t.setTimeout(60000);

// Ensure the serverless CLI is installed
t.before(async () => {
  await execAsync("npx --loglevel=error serverless@3.38.0 --help", {
    cwd: directory,
  });
});

t.test("it does not block by default", async (t) => {
  const { stdout, stderr } = await execAsync(
    "npx --node-options='--no-deprecation' --loglevel=error serverless@3.38.0 invoke local --function login --path payloads/nosql-injection-request.json",
    {
      cwd: directory,
    }
  );

  t.same(stderr, "");
  t.same(getJsonFromLogs(stdout.toString()), {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      token: "123",
      success: true,
    },
  });
});

t.test("it blocks when AIKIDO_BLOCKING is true", async (t) => {
  const { stdout, stderr } = await execAsync(
    "npx --node-options='--no-deprecation' --loglevel=error serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true --function login --path payloads/nosql-injection-request.json",
    {
      cwd: directory,
    }
  );

  t.match(
    stdout,
    'Zen has blocked a NoSQL injection: kind="nosql_injection" operation="MongoDB.Collection.findOne(...)" source="body.password" ip="1.2.3.4"'
  );
  t.match(stderr, /Zen has blocked a NoSQL injection/);
});

t.test(
  "it does not block safe requests when AIKIDO_BLOCKING is true",
  async (t) => {
    const { stdout, stderr } = await execAsync(
      "npx --node-options='--no-deprecation' --loglevel=error serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true --function login --path payloads/safe-request.json",
      {
        cwd: directory,
      }
    );

    t.same(stderr, "");
    t.same(getJsonFromLogs(stdout.toString()), {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        token: "123",
        success: true,
      },
    });
  }
);
