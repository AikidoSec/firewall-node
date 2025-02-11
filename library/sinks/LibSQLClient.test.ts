import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { LibSQLClient } from "./LibSQLClient";
import { createTestAgent } from "../helpers/createTestAgent";

const dangerousContext: Context = {
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

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const testOpts = { skip: !global.Request ? "fetch is not available" : false };

const agent = createTestAgent();
agent.start([new LibSQLClient()]);

t.test("it works with @libsql/client: in-memory", testOpts, async (t) => {
  const { createClient } =
    require("@libsql/client") as typeof import("@libsql/client");

  const client = createClient({
    url: ":memory:",
  });

  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS cats (petname varchar(255));"
    );
    await client.executeMultiple("DELETE FROM cats;");
    t.match(await client.execute("SELECT petname FROM `cats`;"), {
      columns: ["petname"],
      columnTypes: ["varchar(255)"],
      rows: [],
      rowsAffected: 0,
    });

    await runWithContext(dangerousContext, async () => {
      const error = t.throws(() =>
        client.execute("SELECT 1;-- should be blocked")
      );
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: @libsql/client.execute(...) originating from body.myTitle"
        );
      }

      const error2 = t.throws(() =>
        client.executeMultiple("SELECT 1;-- should be blocked")
      );
      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: @libsql/client.executeMultiple(...) originating from body.myTitle"
        );
      }

      const error3 = t.throws(() =>
        client.execute({
          sql: "SELECT 1;-- should be blocked",
          args: [],
        })
      );
      t.ok(error3 instanceof Error);
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked an SQL injection: @libsql/client.execute(...) originating from body.myTitle"
        );
      }

      const error4 = t.throws(() =>
        client.batch([
          {
            sql: "SELECT 1;-- should be blocked",
            args: [],
          },
          {
            sql: "SELECT 1+1;",
            args: [],
          },
        ])
      );
      t.ok(error4 instanceof Error);
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: @libsql/client.batch(...) originating from body.myTitle"
        );
      }

      const error5 = t.throws(() =>
        client.batch([
          {
            sql: "SELECT 1+1;",
            args: [],
          },
          {
            sql: "SELECT 1;-- should be blocked",
            args: [],
          },
        ])
      );
      t.ok(error5 instanceof Error);
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Zen has blocked an SQL injection: @libsql/client.batch(...) originating from body.myTitle"
        );
      }

      const error6 = t.throws(() =>
        client.batch([
          {
            sql: "SELECT 1+1;",
            args: [],
          },
          "SELECT 1;-- should be blocked",
        ])
      );
      t.ok(error6 instanceof Error);
      if (error6 instanceof Error) {
        t.same(
          error6.message,
          "Zen has blocked an SQL injection: @libsql/client.batch(...) originating from body.myTitle"
        );
      }

      client.batch([]);

      // @ts-expect-error Test with invalid parameters
      const error7 = await t.rejects(() => client.batch([false]));
      t.ok(error7 instanceof Error);
      if (error7 instanceof Error) {
        t.same(error7.message, "failed to downcast any to string");
      }

      // @ts-expect-error Test with invalid parameters
      const error8 = await t.rejects(() => client.batch(null));
      t.ok(error8 instanceof Error);
      if (error8 instanceof Error) {
        t.same(
          error8.message,
          "Cannot read properties of null (reading 'map')"
        );
      }

      const transaction = await client.transaction("write");

      const error9 = await t.rejects(() =>
        transaction.execute("SELECT 1;-- should be blocked")
      );
      t.ok(error9 instanceof Error);
      if (error9 instanceof Error) {
        t.same(
          error9.message,
          "Zen has blocked an SQL injection: @libsql/client.transaction.execute(...) originating from body.myTitle"
        );
      }

      const error10 = await t.rejects(() =>
        transaction.batch(["SELECT 1;-- should be blocked"])
      );
      t.ok(error10 instanceof Error);
      if (error10 instanceof Error) {
        t.same(
          error10.message,
          "Zen has blocked an SQL injection: @libsql/client.transaction.batch(...) originating from body.myTitle"
        );
      }

      await transaction.commit();
    });

    await runWithContext(safeContext, async () => {
      await client.execute("SELECT 1;-- This is a comment");
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    client.close();
  }
});

t.test("it works with @libsql/client: http", testOpts, async (t) => {
  const { createClient } =
    require("@libsql/client") as typeof import("@libsql/client");

  const client = createClient({
    url: "http://127.0.0.1:27021",
  });

  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS cats (petname varchar(255));"
    );
    await client.executeMultiple("DELETE FROM cats;");
    t.match(await client.execute("SELECT petname FROM `cats`;"), {
      columns: ["petname"],
      columnTypes: ["varchar(255)"],
      rows: [],
      rowsAffected: 0,
    });

    await runWithContext(dangerousContext, async () => {
      const error = t.throws(() =>
        client.execute("SELECT 1;-- should be blocked")
      );
      t.ok(error instanceof Error);
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked an SQL injection: @libsql/client.execute(...) originating from body.myTitle"
        );
      }

      const error2 = t.throws(() =>
        client.executeMultiple("SELECT 1;-- should be blocked")
      );
      t.ok(error2 instanceof Error);
      if (error2 instanceof Error) {
        t.same(
          error2.message,
          "Zen has blocked an SQL injection: @libsql/client.executeMultiple(...) originating from body.myTitle"
        );
      }

      const error3 = t.throws(() =>
        client.execute({
          sql: "SELECT 1;-- should be blocked",
          args: [],
        })
      );
      t.ok(error3 instanceof Error);
      if (error3 instanceof Error) {
        t.same(
          error3.message,
          "Zen has blocked an SQL injection: @libsql/client.execute(...) originating from body.myTitle"
        );
      }

      const error4 = t.throws(() =>
        client.batch([
          {
            sql: "SELECT 1;-- should be blocked",
            args: [],
          },
          {
            sql: "SELECT 1+1;",
            args: [],
          },
        ])
      );
      t.ok(error4 instanceof Error);
      if (error4 instanceof Error) {
        t.same(
          error4.message,
          "Zen has blocked an SQL injection: @libsql/client.batch(...) originating from body.myTitle"
        );
      }

      const error5 = t.throws(() =>
        client.batch([
          {
            sql: "SELECT 1+1;",
            args: [],
          },
          {
            sql: "SELECT 1;-- should be blocked",
            args: [],
          },
        ])
      );
      t.ok(error5 instanceof Error);
      if (error5 instanceof Error) {
        t.same(
          error5.message,
          "Zen has blocked an SQL injection: @libsql/client.batch(...) originating from body.myTitle"
        );
      }

      const transaction = await client.transaction("write");

      const error9 = await t.rejects(() =>
        transaction.execute("SELECT 1;-- should be blocked")
      );
      t.ok(error9 instanceof Error);
      if (error9 instanceof Error) {
        t.same(
          error9.message,
          "Zen has blocked an SQL injection: @libsql/client.transaction.execute(...) originating from body.myTitle"
        );
      }

      const error10 = await t.rejects(() =>
        transaction.batch(["SELECT 1;-- should be blocked"])
      );
      t.ok(error10 instanceof Error);
      if (error10 instanceof Error) {
        t.same(
          error10.message,
          "Zen has blocked an SQL injection: @libsql/client.transaction.batch(...) originating from body.myTitle"
        );
      }

      await transaction.commit();
    });
  } catch (error: any) {
    t.fail(error);
  } finally {
    client.close();
  }
});
