/* eslint-disable camelcase */
import * as t from "tap";
import { tokenize } from "./tokenize";

t.test("it tokenizes query", async () => {
  const query = "SELECT * FROM users WHERE name = 'John';";
  const tokens = tokenize("mysql", query);
  const expected = [
    { Word: { value: "SELECT", keyword: "SELECT", quote_style: undefined } },
    { Whitespace: "Space" },
    "Mul",
    { Whitespace: "Space" },
    { Word: { value: "FROM", keyword: "FROM", quote_style: undefined } },
    { Whitespace: "Space" },
    { Word: { value: "users", keyword: "NoKeyword", quote_style: undefined } },
    { Whitespace: "Space" },
    { Word: { value: "WHERE", keyword: "WHERE", quote_style: undefined } },
    { Whitespace: "Space" },
    { Word: { value: "name", keyword: "NAME", quote_style: undefined } },
    { Whitespace: "Space" },
    "Eq",
    { Whitespace: "Space" },
    { SingleQuotedString: "John" },
    "SemiColon",
  ];
  t.same(tokens, expected);
});
