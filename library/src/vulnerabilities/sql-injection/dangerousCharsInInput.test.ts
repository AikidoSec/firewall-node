import * as t from "tap";
import { SQL_DANGEROUS_IN_STRING } from "./config";
import { dangerousCharsInInput } from "./dangerousCharsInInput";

SQL_DANGEROUS_IN_STRING.forEach((char) => {
  t.test(`it detects ${char} as dangerous char`, async (t) => {
    t.same(dangerousCharsInInput(char), true);
  });
});

t.test("it returns false for safe chars", async (t) => {
  t.same(dangerousCharsInInput("safe"), false);
});

t.test("it returns true if comment chars are used", async () => {
  t.same(dangerousCharsInInput("This is not ok--"), true);
});
