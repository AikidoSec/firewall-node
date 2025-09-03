const t = require("tap");
const { execSync } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToSampleApp = resolve(
  __dirname,
  "../../sample-apps/hybrid-lambda-express"
);
const testServerUrl = "http://localhost:5874";

let token;
t.beforeEach(async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  token = body.token;
});

t.setTimeout(120000);

t.test("lambda mode sends routes in heartbeat", async (t) => {
  // Remove existing container if running
  try {
    execSync("docker stop hybrid-lambda-test-container");
    execSync("docker rm hybrid-lambda-test-container");
  } catch (e) {
    // Container not running, ignore
  }

  // Pack the firewall library and copy to sample app directory
  const buildPath = resolve(__dirname, "../../build");
  execSync("npm pack", {
    cwd: buildPath,
  });

  execSync(
    "cp aikidosec-firewall-*.tgz ../sample-apps/hybrid-lambda-express/",
    {
      cwd: buildPath,
    }
  );

  // Build the Docker image
  execSync("docker build -t hybrid-lambda-test .", {
    cwd: pathToSampleApp,
  });

  // Start the Lambda container in background
  execSync(`docker run -d --name hybrid-lambda-test-container -p 9000:8080 \
    -e AIKIDO_TOKEN=${token} \
    -e AIKIDO_ENDPOINT=http://host.docker.internal:5874 \
    -e AIKIDO_REALTIME_ENDPOINT=http://host.docker.internal:5874 \
    hybrid-lambda-test`);

  // Wait for the Lambda container to start
  await timeout(5000);

  // Create a Gateway API event
  const event = {
    resource: "/hello",
    httpMethod: "GET",
    path: "/hello",
    headers: {},
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
  };

  // Invoke the Lambda function via the runtime API
  const response = await fetch(
    "http://localhost:9000/2015-03-31/functions/function/invocations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(10000),
    }
  );

  t.equal(response.status, 200);
  const result = await response.json();
  t.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  t.same(body, { message: "Hello World!" });

  const eventsResponse = await fetch(`${testServerUrl}/api/runtime/events`, {
    method: "GET",
    headers: {
      Authorization: token,
    },
    signal: AbortSignal.timeout(5000),
  });

  const events = await eventsResponse.json();
  const heartbeats = events.filter((event) => event.type === "heartbeat");
  console.log(heartbeats);
  t.ok(heartbeats.length > 0, "At least one heartbeat should be sent");

  const heartbeatWithRoutes = heartbeats.find(
    (heartbeat) => heartbeat.routes && heartbeat.routes.length > 0
  );
  t.ok(heartbeatWithRoutes, "Heartbeat should contain routes");

  const helloRoute = heartbeatWithRoutes.routes.find(
    (route) => route.path === "/hello" && route.method === "GET"
  );
  t.ok(helloRoute, "Should contain /hello GET route");
  t.equal(helloRoute.hits, 1, "Route should have 1 hit");

  // Cleanup
  try {
    execSync("docker stop hybrid-lambda-test-container");
    execSync("docker rm hybrid-lambda-test-container");
  } catch (e) {
    // Already stopped/removed
  }
});
