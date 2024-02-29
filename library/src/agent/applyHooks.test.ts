import * as t from "tap";
import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";

t.test("it ignores if package is not installed", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("unknown").withVersion("^1.0.0");

  t.same(applyHooks(hooks), {});
});

t.test("it ignores if packages have empty selectors", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("shimmer").withVersion("^1.0.0");

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: false,
    },
  });
});

t.test("it ignores unknown selectors", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shimmer")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports.doesNotExist)
    .inspect("method", () => {});

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: true,
    },
  });

  // Force require to load shimmer
  require("shimmer");
});

t.test("it ignores if version is not supported", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shimmer")
    .withVersion("^2.0.0")
    .addSubject((exports) => exports)
    .inspect("method", () => {});

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: false,
    },
  });
});

t.test("it adds try/catch around the wrapped method", async (t) => {
  const hooks = new Hooks();
  const connection = hooks
    .addPackage("mysql2")
    .withVersion("^3.0.0")
    .addSubject((exports) => exports.Connection.prototype);
  connection.inspect("query", () => {
    throw new Error("THIS SHOULD BE CATCHED");
  });
  connection.modifyArguments("execute", () => {
    throw new Error("THIS SHOULD BE CATCHED");
  });

  t.same(applyHooks(hooks), {
    mysql2: {
      version: "3.9.2",
      supported: true,
    },
  });

  const mysql = require("mysql2/promise");
  const actualConnection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mypassword",
    database: "catsdb",
    port: 27015,
    multipleStatements: true,
  });

  const [queryRows] = await actualConnection.query("SELECT 1 as number");
  t.same(queryRows, [{ number: 1 }]);

  const [executeRows] = await actualConnection.execute("SELECT 1 as number");
  t.same(executeRows, [{ number: 1 }]);

  await actualConnection.end();
});
