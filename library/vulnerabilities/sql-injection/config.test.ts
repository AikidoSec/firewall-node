import * as t from "tap";
import {
  SQL_DANGEROUS_IN_STRING,
  SQL_ESCAPE_SEQUENCES,
  SQL_KEYWORDS,
  SQL_OPERATORS,
  SQL_STRING_CHARS,
} from "./config";

t.test("SQL_KEYWORDS are valid", async () => {
  SQL_KEYWORDS.forEach((keyword) => {
    t.ok(keyword.length > 0);
  });

  SQL_KEYWORDS.forEach((keyword) => {
    t.same(keyword, keyword.toUpperCase());
  });
});

t.test("SQL_OPERATORS are valid", async () => {
  SQL_OPERATORS.forEach((operator) => {
    t.ok(operator.length > 0);
  });
});

t.test("SQL_STRING_CHARS are valid", async () => {
  SQL_STRING_CHARS.forEach((char) => {
    t.ok(char.length === 1);
  });
});

t.test("SQL_DANGEROUS_IN_STRING are valid", async () => {
  SQL_DANGEROUS_IN_STRING.forEach((char) => {
    t.ok(char.length > 0);
  });
});

t.test("SQL_ESCAPE_SEQUENCES are valid", async () => {
  SQL_ESCAPE_SEQUENCES.forEach((sequence) => {
    t.ok(sequence.length > 0);
  });
});
