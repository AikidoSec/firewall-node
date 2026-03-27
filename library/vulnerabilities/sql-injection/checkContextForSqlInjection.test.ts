import * as t from "tap";
import { setTimeout } from "node:timers/promises";
import { checkContextForSqlInjection } from "./checkContextForSqlInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { createTestAgent } from "../../helpers/createTestAgent";

t.test("it returns correct path", async () => {
  t.same(
    checkContextForSqlInjection({
      sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
      operation: "mysql.query",
      dialect: new SQLDialectMySQL(),
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: {
          id: "1' OR 1=1; --",
        },
        source: "express",
        route: "/",
        routeParams: {},
      },
    }),
    {
      operation: "mysql.query",
      kind: "sql_injection",
      source: "body",
      pathsToPayload: [".id"],
      metadata: {
        sql: "SELECT * FROM users WHERE id = '1' OR 1=1; -- '",
        dialect: "MySQL",
      },
      payload: "1' OR 1=1; --",
    }
  );
});

// SQL that fails to tokenize: unmatched quote makes the tokenizer fail
const failingSQL = `SELECT * FROM comments WHERE comment = 'I'm writting you'`;
const failingInput = "I'm writting you";

const failingContext = {
  cookies: {},
  headers: {},
  remoteAddress: "ip",
  method: "POST" as const,
  url: "url",
  query: {},
  body: {
    comment: failingInput,
  },
  source: "express" as const,
  route: "/",
  routeParams: {},
};

t.test(
  "it does not block failed tokenization when blockInvalidSqlQueries is disabled",
  async () => {
    createTestAgent();

    t.same(
      checkContextForSqlInjection({
        sql: failingSQL,
        operation: "mysql.query",
        dialect: new SQLDialectMySQL(),
        context: failingContext,
      }),
      undefined
    );
  }
);

t.test(
  "it blocks failed tokenization when blockInvalidSqlQueries is enabled",
  async () => {
    const api = new ReportingAPIForTesting({
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
      blockInvalidSqlQueries: true,
    });
    const agent = createTestAgent({
      api,
      token: new Token("test"),
    });
    agent.start([]);
    await setTimeout(0);

    t.same(
      checkContextForSqlInjection({
        sql: failingSQL,
        operation: "mysql.query",
        dialect: new SQLDialectMySQL(),
        context: failingContext,
      }),
      {
        operation: "mysql.query",
        kind: "sql_injection",
        source: "body",
        pathsToPayload: [".comment"],
        metadata: {
          sql: failingSQL,
          dialect: "MySQL",
        },
        payload: failingInput,
      }
    );
  }
);
