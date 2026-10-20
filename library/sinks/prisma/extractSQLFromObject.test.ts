import * as t from "tap";
import { extractSQLFromObject } from "./extractSQLFromObject";
import { SQLDialectPostgres } from "../../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { SQLDialectGeneric } from "../../vulnerabilities/sql-injection/dialects/SQLDialectGeneric";
import { SQLDialectSQLite } from "../../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

t.test("extractSQLFromArgs - string argument", async (t) => {
  const sql = "SELECT * FROM users WHERE id = 1";
  const result = extractSQLFromObject([sql], new SQLDialectGeneric());
  t.equal(result, sql);
});

t.test("extractSQLFromArgs - empty args", async (t) => {
  const result = extractSQLFromObject([], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - empty string argument", async (t) => {
  const result = extractSQLFromObject([""], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - unsupported first argument", async (t) => {
  const result = extractSQLFromObject([123], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test(
  "extractSQLFromArgs - tagged template with generic dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ""],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users WHERE id = ? AND role = ?");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with postgres dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ""],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectPostgres());
    t.equal(result, "SELECT * FROM users WHERE id = $1 AND role = $2");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with postgres dialect with semicolon",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ";"],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectPostgres());
    t.equal(result, "SELECT * FROM users WHERE id = $1 AND role = $2;");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with sqlite dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ""],
      values: [1],
    };

    const result = extractSQLFromObject(template, new SQLDialectSQLite());
    t.equal(result, "SELECT * FROM users WHERE id = ?");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with sqlite dialect with empty values",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ";"],
      values: [],
    };

    const result = extractSQLFromObject(template, new SQLDialectSQLite());
    t.equal(result, "SELECT * FROM users WHERE id = ;");
  }
);

t.test("extractSQLFromArgs - invalid template strings", async (t) => {
  const invalidTemplate = {
    strings: ["SELECT * FROM users WHERE id = ", 123],
    values: [1],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - invalid template missing values", async (t) => {
  const invalidTemplate = {
    strings: ["SELECT * FROM users"],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - invalid template empty strings", async (t) => {
  const invalidTemplate = {
    strings: [],
    values: [],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});
