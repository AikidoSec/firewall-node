import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext, runWithContext } from "../agent/Context";
import { GraphQL } from "./GraphQL";
import { Token } from "../agent/api/Token";
import { createTestAgent } from "../helpers/createTestAgent";

function getTestContext() {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/graphql",
    query: {},
    headers: {},
    body: { query: '{ getFile(path: "/etc/bashrc") }' },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };
}

t.test("it works", async () => {
  const agent = createTestAgent({
    api: new ReportingAPIForTesting({
      success: true,
      endpoints: [
        {
          method: "POST",
          route: "/graphql",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 3,
            windowSizeInMS: 60 * 1000,
          },
          graphql: {
            name: "getFile",
            type: "query",
          },
        },
      ],
      allowedIPAddresses: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
    }),
    token: new Token("123"),
  });

  agent.start([new GraphQL()]);

  const { graphql, buildSchema } =
    require("graphql") as typeof import("graphql");

  const schema = buildSchema(`
        type Query {
            getFile(path: String): String
        }
    `);

  const root = {
    getFile: ({ path }: { path: string }) => {
      return "file content";
    },
  };

  const query = async (path: string, variableValues?: Record<string, any>) => {
    return await graphql({
      schema,
      source: `{ getFile(path: "${path}") }`,
      rootValue: root,
      variableValues: variableValues,
    });
  };

  await query("/etc/bashrc");

  await runWithContext(getTestContext(), async () => {
    await query("/etc/bashrc");
    t.same(getContext()?.graphql, ["/etc/bashrc"]);
  });

  await runWithContext(getTestContext(), async () => {
    await query("/etc/bashrc", {
      test: "user input",
    });
    t.same(getContext()?.graphql, ["/etc/bashrc", "user input"]);
  });

  // Rate limiting works
  await runWithContext(getTestContext(), async () => {
    const success = await query("/etc/bashrc");
    t.same(success.data!.getFile, "file content");
    await query("/etc/bashrc");
    await query("/etc/bashrc");
    const result = await query("/etc/bashrc");
    t.same(result.errors![0].message, "You are rate limited by Zen.");
  });
});
