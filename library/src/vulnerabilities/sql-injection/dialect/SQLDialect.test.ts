import * as t from "tap";
import { SQLDialect } from "./SQLDialect";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { SQLDialectPostgres } from "./SQLDialectPostgres";

const dialects: SQLDialect[] = [
  new SQLDialectMySQL(),
  new SQLDialectPostgres(),
];

t.test("it returns a list of unique keywords", async (t) => {
  for (const dialect of dialects) {
    const keywords = dialect.getKeywords();
    t.ok(keywords.length > 0, "has keywords");
    t.same(keywords.length, new Set(keywords).size, "keywords are unique");
    keywords.forEach((k) => {
      if (!k.match(/^[a-zA-Z_0-9\-]+$/)) {
        t.fail(`keyword "${k}" is not a valid identifier`);
      }
    });
  }
});

t.test("it returns a list of unique operators", async (t) => {
  for (const dialect of dialects) {
    const operators = dialect.getOperators();
    t.ok(operators.length > 0, "has operators");
    t.same(operators.length, new Set(operators).size, "operators are unique");
  }
});
