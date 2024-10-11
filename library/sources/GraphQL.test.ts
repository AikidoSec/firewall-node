import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { getContext, runWithContext } from "../agent/Context";
import { GraphQL } from "./GraphQL";
import { Token } from "../agent/api/Token";
import { createTestAgent } from "../helpers/createTestAgent";

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

  const { graphql, buildSchema } = require("graphql");

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

  const query = async (path: string) => {
    return await graphql({
      schema,
      source: `{ getFile(path: "${path}") }`,
      rootValue: root,
    });
  };

  const context = {
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

  await query("/etc/bashrc");

  await runWithContext(context, async () => {
    await query("/etc/bashrc");
    t.same(getContext()?.graphql, ["/etc/bashrc"]);
  });

  // Rate limiting works
  await runWithContext(context, async () => {
    const success = await query("/etc/bashrc");
    t.same(success.data.getFile, "file content");
    await query("/etc/bashrc");
    await query("/etc/bashrc");
    const result = await query("/etc/bashrc");
    t.same(
      result.errors[0].message,
      "You are rate limited by Aikido firewall."
    );
  });
});
