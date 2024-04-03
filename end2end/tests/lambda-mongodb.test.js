const t = require("tap");
const { resolve } = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

const directory = resolve(__dirname, "../../sample-apps/lambda-mongodb");

// Invoking serverless functions can be slow
t.setTimeout(60000);

// Ensure the serverless CLI is installed
t.before(async () => {
  await execAsync("npx --loglevel=error serverless --help", {
    cwd: directory,
  });
});

t.test("it does not block by default", async (t) => {
  const { stdout, stderr } = await execAsync(
    "npx --node-options='--no-deprecation' --loglevel=error serverless invoke local --function login --path payloads/nosql-injection-request.json",
    {
      cwd: directory,
    }
  );

  t.same(stderr, "");
  t.same(JSON.parse(stdout.toString()), {
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
    "npx --node-options='--no-deprecation' --loglevel=error serverless invoke local -e AIKIDO_BLOCKING=true --function login --path payloads/nosql-injection-request.json",
    {
      cwd: directory,
    }
  );

  t.same(stdout, "");
  t.match(stderr, /Aikido runtime has blocked a NoSQL injection/);
});

t.test(
  "it does not block safe requests when AIKIDO_BLOCKING is true",
  async (t) => {
    const { stdout, stderr } = await execAsync(
      "npx --node-options='--no-deprecation' --loglevel=error serverless invoke local -e AIKIDO_BLOCKING=true --function login --path payloads/safe-request.json",
      {
        cwd: directory,
      }
    );

    t.same(stderr, "");
    t.same(JSON.parse(stdout.toString()), {
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
