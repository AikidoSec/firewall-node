const t = require("tap");
const { spawn } = require("child_process");
const { resolve } = require("path");
const timeout = require("../timeout");

const pathToApp = resolve(
  __dirname,
  "../../sample-apps/express-graphql",
  "app.js"
);
const testServerUrl = "http://localhost:5874";

let token;
t.beforeEach(async () => {
  const response = await fetch(`${testServerUrl}/api/runtime/apps`, {
    method: "POST",
  });
  const body = await response.json();
  token = body.token;

  // Apply rate limiting
  const updateConfigResponse = await fetch(
    `${testServerUrl}/api/runtime/config`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        endpoints: [
          {
            route: "/graphql",
            method: "*",
            graphql: {
              type: "mutation",
              name: "addCat",
            },
            forceProtectionOff: false,
            rateLimiting: {
              enabled: true,
              maxRequests: 1,
              windowSizeInMS: 60 * 1000,
            },
          },
        ],
      }),
    }
  );
  t.same(updateConfigResponse.status, 200);
});

t.setTimeout(80000);

t.test("it blocks in blocking mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4000"], {
    env: { ...process.env, AIKIDO_DEBUG: "true", AIKIDO_BLOCKING: "true" },
  });

  server.on("close", () => {
    t.end();
  });

  server.on("error", (err) => {
    t.fail(err.message);
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() => {
      return Promise.all([
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "1\' OR 1=1; -- ") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://localhost:4000/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "Test") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
      ]);
    })
    .then(async ([sqlInjection, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalSearch.status, 200);
      const sqlInjectionText = await sqlInjection.text();
      const normalSearchText = await normalSearch.text();
      t.match(sqlInjectionText, /Zen has blocked an SQL injection/);
      t.notMatch(normalSearchText, /Zen has blocked an SQL injection/);
      t.match(stdout, /Starting agent/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it does not block in dry mode", (t) => {
  const server = spawn(`node`, [pathToApp, "4001"], {
    env: { ...process.env, AIKIDO_DEBUG: "true" },
  });

  server.on("close", () => {
    t.end();
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() =>
      Promise.all([
        fetch(`http://localhost:4001/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "1\' OR 1=1; -- ") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
        fetch(`http://localhost:4001/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: 'query { cats(name: "Test") { petname age } }',
          }),
          signal: AbortSignal.timeout(5000),
        }),
      ])
    )
    .then(async ([sqlInjection, normalSearch]) => {
      t.equal(sqlInjection.status, 200);
      t.equal(normalSearch.status, 200);
      const sqlInjectionText = await sqlInjection.text();
      const normalSearchText = await normalSearch.text();
      t.notMatch(sqlInjectionText, /Zen has blocked an SQL injection/);
      t.notMatch(normalSearchText, /Zen has blocked an SQL injection/);
      t.match(stdout, /Starting agent/);
      t.notMatch(stderr, /Zen has blocked an SQL injection/);
    })
    .catch((error) => {
      t.fail(error.message);
    })
    .finally(() => {
      server.kill();
    });
});

t.test("it rate limits GraphQL fields", (t) => {
  const server = spawn(`node`, [pathToApp, "4003"], {
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCKING: "true",
      AIKIDO_TOKEN: token,
      AIKIDO_ENDPOINT: testServerUrl,
      AIKIDO_REALTIME_ENDPOINT: testServerUrl,
    },
  });

  server.on("close", () => {
    t.end();
  });

  server.on("error", (err) => {
    t.fail(err);
  });

  let stdout = "";
  server.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  // Wait for the server to start
  timeout(2000)
    .then(() => {
      return fetch(`http://localhost:4003/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: 'mutation { addCat(petname: "Njuska", age: 3) }',
        }),
        signal: AbortSignal.timeout(5000),
      });
    })
    .then(async (response) => {
      t.equal(response.status, 200);
      const json = await response.json();
      t.same(json, {
        data: {
          addCat: true,
        },
      });

      return fetch(`http://localhost:4003/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: 'mutation { addCat(petname: "Harry", age: 4) }',
        }),
        signal: AbortSignal.timeout(5000),
      });
    })
    .then(async (response) => {
      const json = await response.json();
      t.match(json, {
        errors: [
          {
            message: "You are rate limited by Zen.",
            extensions: {
              code: "RATE_LIMITED_BY_ZEN",
            },
          },
        ],
      });

      await timeout(60 * 1000); // Wait for heartbeat

      return fetch(`${testServerUrl}/api/runtime/events`, {
        method: "GET",
        headers: {
          Authorization: token,
        },
      });
    })
    .then((response) => {
      return response.json();
    })
    .then((events) => {
      const heartbeats = events.filter((event) => event.type === "heartbeat");
      t.same(heartbeats.length, 1);
      const stats = heartbeats[0].stats;
      t.match(stats, {
        requests: {
          total: 2,
          rateLimited: 1,
        },
      });
      const routes = heartbeats[0].routes;
      t.same(routes, [
        {
          method: "POST",
          path: "/graphql",
          hits: 2,
          rateLimitedCount: 0,
          graphql: { type: "mutation", name: "addCat" },
          apispec: {},
        },
        {
          method: "POST",
          path: "/graphql",
          hits: 2,
          rateLimitedCount: 0,
          apispec: {},
          graphQLSchema: `schema {
  query: RootQueryType
  mutation: RootMutationType
}

type RootQueryType {
  cats(name: String): [Cat]
}

type Cat {
  petname: String
  age: Int
}

type RootMutationType {
  addCat(petname: String, age: Int): Boolean
}`,
        },
        {
          method: "*",
          path: "/graphql",
          hits: 0,
          rateLimitedCount: 1,
          graphql: { type: "mutation", name: "addCat" },
          apispec: {},
        },
      ]);
    })
    .catch((error) => {
      t.fail(error);
    })
    .finally(() => {
      server.kill();
    });
});
