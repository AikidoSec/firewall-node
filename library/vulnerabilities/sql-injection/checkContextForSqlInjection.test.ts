import * as t from "tap";
import { checkContextForSqlInjection } from "./checkContextForSqlInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { Context } from "../../agent/Context";

t.beforeEach(() => {
  delete process.env.AIKIDO_BLOCK_INVALID_SQL;
});

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

function createFailingContext(): Context {
  return {
    cookies: {},
    headers: {},
    remoteAddress: "ip",
    method: "POST",
    url: "url",
    query: {},
    body: {
      comment: failingInput,
    },
    source: "express",
    route: "/",
    routeParams: {},
  };
}

t.test("it does not block failed tokenization by default", async () => {
  t.same(
    checkContextForSqlInjection({
      sql: failingSQL,
      operation: "mysql.query",
      dialect: new SQLDialectMySQL(),
      context: createFailingContext(),
    }),
    undefined
  );
});

t.test(
  "it blocks failed tokenization when AIKIDO_BLOCK_INVALID_SQL is true",
  async () => {
    process.env.AIKIDO_BLOCK_INVALID_SQL = "true";

    t.same(
      checkContextForSqlInjection({
        sql: failingSQL,
        operation: "mysql.query",
        dialect: new SQLDialectMySQL(),
        context: createFailingContext(),
      }),
      {
        operation: "mysql.query",
        kind: "sql_injection",
        source: "body",
        pathsToPayload: [".comment"],
        metadata: {
          sql: failingSQL,
          dialect: "MySQL",
          failedToTokenize: "true",
        },
        payload: failingInput,
      }
    );
  }
);

t.test("it detects SQL injection in multipart file metadata", async () => {
  t.same(
    checkContextForSqlInjection({
      sql: "SELECT id, label FROM documents WHERE label = '' OR '1'='1'",
      operation: "mysql.query",
      dialect: new SQLDialectMySQL(),
      context: {
        cookies: {},
        headers: {},
        remoteAddress: "ip",
        method: "POST",
        url: "url",
        query: {},
        body: undefined,
        files: [
          {
            fieldname: "document",
            originalname: "' OR '1'='1",
            encoding: "7bit",
            mimetype: "application/pdf",
          },
        ],
        source: "express",
        route: "/",
        routeParams: {},
      },
    }),
    {
      operation: "mysql.query",
      kind: "sql_injection",
      source: "files",
      pathsToPayload: [".[0].originalname"],
      metadata: {
        sql: "SELECT id, label FROM documents WHERE label = '' OR '1'='1'",
        dialect: "MySQL",
      },
      payload: "' OR '1'='1",
    }
  );
});
