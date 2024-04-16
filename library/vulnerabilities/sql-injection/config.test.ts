import * as t from "tap";
import {
  SQL_DANGEROUS_IN_STRING,
  COMMON_SQL_KEYWORDS,
  SQL_ESCAPE_SEQUENCES,
  SQL_KEYWORDS,
  SQL_OPERATORS,
  SQL_STRING_CHARS,
} from "./config";

t.test("SQL_KEYWORDS are not empty", async () => {
  SQL_KEYWORDS.forEach((keyword) => {
    t.ok(keyword.length > 0);
  });
});

t.test("SQL_KEYWORDS are uppercase", async () => {
  SQL_KEYWORDS.forEach((keyword) => {
    t.same(keyword, keyword.toUpperCase());
  });
});

t.test("COMMON_SQL_KEYWORDS are not empty", async () => {
  COMMON_SQL_KEYWORDS.forEach((keyword) => {
    t.ok(keyword.length > 0);
  });
});

t.test("COMMON_SQL_KEYWORDS are uppercase", async () => {
  COMMON_SQL_KEYWORDS.forEach((keyword) => {
    t.same(keyword, keyword.toUpperCase());
  });
});

t.test("SQL_OPERATORS are not empty", async () => {
  SQL_OPERATORS.forEach((operator) => {
    t.ok(operator.length > 0);
  });
});

t.test("SQL_STRING_CHARS are single chars", async () => {
  SQL_STRING_CHARS.forEach((char) => {
    t.ok(char.length === 1);
  });
});

t.test("SQL_DANGEROUS_IN_STRING are not empty", async () => {
  SQL_DANGEROUS_IN_STRING.forEach((char) => {
    t.ok(char.length > 0);
  });
});

t.test("SQL_ESCAPE_SEQUENCES are not empty", async () => {
  SQL_ESCAPE_SEQUENCES.forEach((sequence) => {
    t.ok(sequence.length > 0);
  });
});
