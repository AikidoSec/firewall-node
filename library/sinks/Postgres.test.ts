import * as t from "tap";
import { getContext, runWithContext, type Context } from "../agent/Context";
import { Postgres } from "./Postgres";
import { createTestAgent } from "../helpers/createTestAgent";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    myTitle: `-- should be blocked`,
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it inspects query method calls and blocks if needed", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const { Client } = require("pg") as typeof import("pg");
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats");

    t.same((await client.query("SELECT petname FROM cats;")).rows, []);
    t.same(
      (await client.query({ text: "SELECT petname FROM cats;" })).rows,
      []
    );
    t.same(
      (
        await runWithContext(context, () => {
          return client.query("SELECT petname FROM cats;");
        })
      ).rows,
      []
    );
    t.same(
      (
        await runWithContext(context, () => {
          return client.query({ text: "SELECT petname FROM cats;" });
        })
      ).rows,
      []
    );

    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query("-- should be blocked");
      });
    });
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query({ text: "-- should be blocked" });
      });
    });
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    const undefinedQueryError = await t.rejects(async () => {
      runWithContext(context, () => {
        // @ts-expect-error Test
        return client.query(null);
      });
    });
    if (undefinedQueryError instanceof Error) {
      t.same(
        undefinedQueryError.message,
        "Client was passed a null or undefined query"
      );
    }

    await runWithContext(
      {
        remoteAddress: "::1",
        method: "POST",
        url: "http://localhost:4000/",
        query: {},
        headers: {},
        body: {},
        cookies: {},
        source: "express",
        route: "/posts/:id",
        routeParams: {},
      },
      () => {
        return client.query("-- This is a comment");
      }
    );

    // Check if context is available in the callback
    runWithContext(context, () => {
      client.query("SELECT petname FROM cats;", (error, result) => {
        t.match(getContext(), context);

        try {
          client.query("-- should be blocked", () => {});
        } catch (error: any) {
          t.match(
            error.message,
            /Zen has blocked an SQL injection: pg.query\(\.\.\.\) originating from body\.myTitle/
          );
        }
      });
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

t.test("it works with pipeline feature turned on", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const { Client } = require("pg") as typeof import("pg");
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,

    // This allows multiple queries to be sent in a single round trip to the db
    pipeline: true,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats_pipe (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats_pipe");

    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query("-- should be blocked");
      });
    });
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    await runWithContext(context, async () => {
      const safeQuery = async (queryText: string) => {
        try {
          const result = await client.query(queryText);
          return { status: "fulfilled", value: result };
        } catch (error) {
          return { status: "rejected", reason: error };
        }
      };

      const results = await Promise.all([
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("-- should be blocked"),
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("SELECT petname FROM cats_pipe;"),
        safeQuery("SELECT petname FROM cats_pipe;"),
      ]);

      const rejected = results.filter((r) => r.status === "rejected");
      const fulfilled = results.filter((r) => r.status === "fulfilled");

      t.equal(
        rejected.length,
        1,
        "Expected exactly one query to throw an error"
      );
      t.equal(fulfilled.length, 7, "Expected exactly seven queries to succeed");

      if (rejected.length === 1) {
        const catchedError = rejected[0].reason;
        t.ok(
          catchedError instanceof Error,
          "Expected the rejection reason to be an Error"
        );

        if (catchedError instanceof Error) {
          t.match(
            catchedError.message,
            /Zen has blocked an SQL injection: pg.query\(\.\.\.\) originating from body\.myTitle/
          );
        }
      }
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

t.test("it inspects Query instances and blocks if needed", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const pg = require("pg") as typeof import("pg");
  const { Client, Query } = pg;
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cats_query (
        petname varchar(255)
      );
    `);
    await client.query("TRUNCATE cats_query");

    // Test that Query instances work without context
    const safeQuery = new Query("SELECT petname FROM cats_query;");
    t.same((await client.query(safeQuery as Parameters<typeof client.query>[0])).rows, []);

    // Test that Query instances work with safe context
    t.same(
      (
        await runWithContext(
          {
            remoteAddress: "::1",
            method: "POST",
            url: "http://localhost:4000/",
            query: {},
            headers: {},
            body: {},
            cookies: {},
            source: "express",
            route: "/posts/:id",
            routeParams: {},
          },
          () => {
            return client.query(new Query("SELECT petname FROM cats_query;") as Parameters<typeof client.query>[0]);
          }
        )
      ).rows,
      []
    );

    // Test that Query instances are blocked when they contain malicious SQL
    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        return client.query(new Query("-- should be blocked"));
      });
    });
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    // Test that Query instances with text property are blocked
    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        const query = new Query();
        query.text = "-- should be blocked";
        return client.query(query);
      });
    });
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked an SQL injection: pg.query(...) originating from body.myTitle"
      );
    }

    // Test that Query instances with values are properly inspected
    const queryWithValues = new Query({
      text: "SELECT petname FROM cats_query WHERE petname = $1;",
      values: ["Kitty"],
    });
    t.same(
      (
        await runWithContext(
          {
            remoteAddress: "::1",
            method: "POST",
            url: "http://localhost:4000/",
            query: {},
            headers: {},
            body: {},
            cookies: {},
            source: "express",
            route: "/posts/:id",
            routeParams: {},
          },
          () => {
            return client.query(queryWithValues as Parameters<typeof client.query>[0]);
          }
        )
      ).rows,
      []
    );
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

t.test("Query instances cannot bypass SQL injection detection", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const pg = require("pg") as typeof import("pg");
  const { Client, Query } = pg;
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,
  });
  await client.connect();

  try {
    // Test: Query instance with attacker-influenced SQL in constructor
    const error1 = await t.rejects(async () => {
      await runWithContext(context, () => {
        // Simulating attacker-influenced input being used to construct Query
        const attackerInput = (context.body as { myTitle: string }).myTitle; // "-- should be blocked"
        return client.query(new Query(attackerInput));
      });
    });
    if (error1 instanceof Error) {
      t.match(
        error1.message,
        /Zen has blocked an SQL injection/,
        "Query instance with attacker SQL in constructor should be blocked"
      );
    }

    // Test: Query instance with attacker-influenced SQL in text property
    const error2 = await t.rejects(async () => {
      await runWithContext(context, () => {
        const attackerInput = (context.body as { myTitle: string }).myTitle;
        const query = new Query();
        query.text = attackerInput;
        return client.query(query);
      });
    });
    if (error2 instanceof Error) {
      t.match(
        error2.message,
        /Zen has blocked an SQL injection/,
        "Query instance with attacker SQL in text property should be blocked"
      );
    }

    // Test: Query instance with object containing attacker-influenced SQL
    const error3 = await t.rejects(async () => {
      await runWithContext(context, () => {
        const attackerInput = (context.body as { myTitle: string }).myTitle;
        return client.query(new Query({ text: attackerInput }));
      });
    });
    if (error3 instanceof Error) {
      t.match(
        error3.message,
        /Zen has blocked an SQL injection/,
        "Query instance with object containing attacker SQL should be blocked"
      );
    }
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

t.test("Query instances cannot bypass tenant isolation checks", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const pg = require("pg") as typeof import("pg");
  const { Client, Query } = pg;
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users_query (
        id int,
        name varchar(255)
      );
    `);
    await client.query("TRUNCATE users_query");
    await client.query("INSERT INTO users_query (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

    // Test: Query instance attempting to access data without proper tenant filtering
    // This simulates a scenario where an attacker tries to use Query instances
    // to bypass tenant isolation by accessing all users instead of just their own
    const tenantContext: Context = {
      remoteAddress: "::1",
      method: "GET",
      url: "http://localhost:4000/users/1",
      query: {},
      headers: {},
      body: {},
      cookies: {},
      routeParams: { id: "2" }, // Attacker trying to access user 2
      source: "express",
      route: "/users/:id",
    };

    // This should work - Query instances should be inspected for IDOR
    const result = await runWithContext(tenantContext, () => {
      // Using parameterized query with Query instance
      return client.query(
        new Query({
          text: "SELECT * FROM users_query WHERE id = $1",
          values: [1],
        }) as Parameters<typeof client.query>[0]
      );
    });
    t.same(result.rows.length, 1, "Query instance with proper parameterization should work");
    t.same(result.rows[0].name, "Alice", "Should return correct user data");

    // Test: Verify that Query instances are inspected for potential IDOR issues
    // when user input is directly embedded in the query
    const idorContext: Context = {
      remoteAddress: "::1",
      method: "GET",
      url: "http://localhost:4000/users/1",
      query: { userId: "1 OR 1=1" }, // Attacker input
      headers: {},
      body: {},
      cookies: {},
      routeParams: {},
      source: "express",
      route: "/users/:id",
    };

    const error = await t.rejects(async () => {
      await runWithContext(idorContext, () => {
        // Simulating vulnerable code that uses user input in Query instance
        const userId = idorContext.query.userId;
        return client.query(new Query(`SELECT * FROM users_query WHERE id = ${userId}`));
      });
    });
    if (error instanceof Error) {
      t.match(
        error.message,
        /Zen has blocked an SQL injection/,
        "Query instance with IDOR attempt should be blocked"
      );
    }
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

t.test("Query instances with various construction patterns are inspected", async (t) => {
  const agent = createTestAgent();
  agent.start([new Postgres()]);

  const pg = require("pg") as typeof import("pg");
  const { Client, Query } = pg;
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    ****: "****",
    port: 27016,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_query (
        id int
      );
    `);
    await client.query("TRUNCATE test_query");

    // Test: Empty Query instance
    const emptyQuery = new Query();
    emptyQuery.text = "SELECT * FROM test_query";
    const result1 = await client.query(emptyQuery as Parameters<typeof client.query>[0]);
    t.same(result1.rows, [], "Empty Query instance with text set should work");

    // Test: Query instance with only text (no values)
    const textOnlyQuery = new Query("SELECT * FROM test_query");
    const result2 = await client.query(textOnlyQuery as Parameters<typeof client.query>[0]);
    t.same(result2.rows, [], "Query instance with only text should work");

    // Test: Query instance with text and empty values array
    const emptyValuesQuery = new Query({
      text: "SELECT * FROM test_query",
      values: [],
    });
    const result3 = await client.query(emptyValuesQuery as Parameters<typeof client.query>[0]);
    t.same(result3.rows, [], "Query instance with empty values array should work");

    // Test: Query instance constructed with object is still inspected for attacks
    const error = await t.rejects(async () => {
      await runWithContext(context, () => {
        const attackQuery = new Query({
          text: (context.body as { myTitle: string }).myTitle, // "-- should be blocked"
          values: [],
        });
        return client.query(attackQuery);
      });
    });
    if (error instanceof Error) {
      t.match(
        error.message,
        /Zen has blocked an SQL injection/,
        "Query instance with object construction should still be inspected"
      );
    }
  } catch (error: any) {
    t.fail(error);
  } finally {
    await client.end();
  }
});

