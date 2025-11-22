import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, getContext, runWithContext } from "../agent/Context";
import { startTestAgent } from "../helpers/startTestAgent";
import { GraphQL } from "./GraphQL";

function getTestContext() {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/graphql",
    query: {},
    headers: {
      "content-type": "application/json",
    },
    body: { query: '{ getFile(path: "/etc/bashrc") }' },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };
}

export function createGraphQLTests(pkgName: string) {
  t.test("it works", async () => {
    const agent = startTestAgent({
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
      wrappers: [new GraphQL()],
      rewrite: {
        graphql: pkgName,
      },
    });

    const { graphql, buildSchema } = require(
      pkgName
    ) as typeof import("graphql");

    const schema = buildSchema(`
        type Query {
            getFile(path: String): String
            anotherQuery: String
        }
    `);

    const root = {
      getFile: ({ path }: { path: string }) => {
        return "file content";
      },
      anotherQuery: () => {
        return "another query";
      },
    };

    const query = async (
      path: string,
      variableValues?: Record<string, any>
    ) => {
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

      const result = await query("/etc/bashrc");
      t.same(result.errors![0].message, "You are rate limited by Zen.");

      await query("/etc/bashrc");
      await query("/etc/bashrc");

      // With operation name
      t.same(
        await graphql({
          schema,
          source: `
        query getFile {
          getFile(path: "/etc/bashrc")
        }

        query anotherQuery {
          anotherQuery
        }
      `,
          rootValue: root,
          variableValues: {},
          operationName: "anotherQuery",
        }),
        {
          data: { anotherQuery: "another query" },
        }
      );
    });

    t.same(agent.getRoutes().asArray(), [
      {
        method: "POST",
        path: "/graphql",
        hits: 6,
        rateLimitedCount: 0, // Counted in finish event of the incoming http request
        graphql: {
          type: "query",
          name: "getFile",
        },
        apispec: {},
        graphQLSchema: undefined,
      },
      {
        method: "POST",
        path: "/graphql",
        hits: 1,
        rateLimitedCount: 0,
        graphql: {
          type: "query",
          name: "anotherQuery",
        },
        apispec: {},
        graphQLSchema: undefined,
      },
    ]);

    // Empty context
    await runWithContext({} as Context, async () => {
      const response = await query("/etc/bashrc");
      t.same(response, { data: { getFile: "file content" } });
    });
  });
}
