/* eslint-disable camelcase */
import * as t from "tap";
import { tokenize } from "./tokenize";

t.test("it tokenizes query", async () => {
  const query = `SELECT * FROM users WHERE name = 'John';`;
  const tokens = tokenize("mysql", query);
  const expected = [
    { Word: { value: "SELECT", quote_style: undefined, keyword: "SELECT" } },
    { Whitespace: "Space" },
    "Mul",
    { Whitespace: "Space" },
    { Word: { value: "FROM", quote_style: undefined, keyword: "FROM" } },
    { Whitespace: "Space" },
    { Word: { value: "users", quote_style: undefined, keyword: "NoKeyword" } },
    { Whitespace: "Space" },
    { Word: { value: "WHERE", quote_style: undefined, keyword: "WHERE" } },
    { Whitespace: "Space" },
    { Word: { value: "name", quote_style: undefined, keyword: "NAME" } },
    { Whitespace: "Space" },
    "Eq",
    { Whitespace: "Space" },
    { SingleQuotedString: "John" },
    "SemiColon",
  ];
  t.same(tokens, expected);
});
