import * as express from "express";
import * as asyncHandler from "express-async-handler";
import * as t from "tap";
import { Token } from "./Token";
import { FetchListsAPINodeHTTP } from "./FetchListsAPINodeHTTP";
import { FetchListsAPIResponse } from "./FetchListsAPI";

function createTestEndpoint({
  statusCode,
  sleepInMs,
  port,
  response = {
    blockedIPAddresses: [
      {
        key: "test",
        source: "test",
        description: "this is a test",
        ips: ["1.2.3.4"],
      },
    ],
    allowedIPAddresses: [],
    monitoredIPAddresses: [],
    blockedUserAgents: "hacker",
    monitoredUserAgents: "",
    userAgentDetails: [],
  },
}: {
  sleepInMs?: number;
  statusCode?: number;
  port: number;
  response?: FetchListsAPIResponse;
}): Promise<() => Promise<void>> {
  const app = express();
  app.set("env", "test");

  app.get(
    "/api/runtime/firewall/lists",
    asyncHandler(async (req, res) => {
      if (sleepInMs) {
        await new Promise((resolve) => setTimeout(resolve, sleepInMs));
      }

      if (statusCode) {
        res.status(statusCode);
      }

      res.send(response);
    })
  );

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      resolve(() => {
        return new Promise((resolve) =>
          server.close(() => {
            resolve();
          })
        );
      });
    });
  });
}

t.test("it fetches the lists", async (t) => {
  const stop = await createTestEndpoint({ port: 9000 });
  const api = new FetchListsAPINodeHTTP(new URL("http://localhost:9000"));
  t.same(await api.fetch(new Token("123")), {
    blockedIPAddresses: [
      {
        key: "test",
        source: "test",
        description: "this is a test",
        ips: ["1.2.3.4"],
      },
    ],
    allowedIPAddresses: [],
    monitoredIPAddresses: [],
    blockedUserAgents: "hacker",
    monitoredUserAgents: "",
    userAgentDetails: [],
  });

  await stop();
});

t.test("invalid token", async (t) => {
  const stop = await createTestEndpoint({ port: 9001, statusCode: 401 });
  const api = new FetchListsAPINodeHTTP(new URL("http://localhost:9001"));
  await t.rejects(api.fetch(new Token("123---")), {
    message: "Unable to access the Aikido platform, please check your token.",
  });

  await stop();
});

t.test("server error", async (t) => {
  const stop = await createTestEndpoint({ port: 9002, statusCode: 500 });
  const api = new FetchListsAPINodeHTTP(new URL("http://localhost:9002"));
  await t.rejects(api.fetch(new Token("123")), {
    message: "Failed to fetch blocked lists: 500",
  });

  await stop();
});

t.test("invalid response", async (t) => {
  const stop = await createTestEndpoint({
    port: 9003,
    response: {
      // @ts-expect-error Invalid response testing
      blockedIPAddresses: "invalid",
      // @ts-expect-error Invalid response testing
      allowedIPAddresses: "invalid",
      // @ts-expect-error Invalid response testing
      monitoredIPAddresses: "invalid",
      // @ts-expect-error Invalid response testing
      blockedUserAgents: [],
      // @ts-expect-error Invalid response testing
      monitoredUserAgents: [],
      // @ts-expect-error Invalid response testing
      userAgentDetails: "invalid",
    },
  });
  const api = new FetchListsAPINodeHTTP(new URL("http://localhost:9003"));

  t.same(await api.fetch(new Token("123")), {
    blockedIPAddresses: [],
    allowedIPAddresses: [],
    monitoredIPAddresses: [],
    blockedUserAgents: "",
    monitoredUserAgents: "",
    userAgentDetails: [],
  });

  await stop();
});
