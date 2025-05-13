import * as t from "tap";
import { shouldReturnEarly } from "./shouldReturnEarly";

t.test("it returns true if code is shorter than user input", async (t) => {
  t.same(true, shouldReturnEarly("code", "user input code"));
});

t.test("it returns true if code not user input", async (t) => {
  t.same(true, shouldReturnEarly("code code code", "user input"));
});

t.test("it returns true if shorter than 3 chars", async (t) => {
  t.same(true, shouldReturnEarly("a(", "a("));
});

t.test("it returns true if alphanumeric", async (t) => {
  t.same(true, shouldReturnEarly("abc123_", "abc123_"));
});

t.test("it returns true if comma separated list of numbers", async (t) => {
  t.same(true, shouldReturnEarly("1,2,3", "1,2,3"));
  t.same(true, shouldReturnEarly("1, 2, 3", "1, 2, 3"));
});

t.test("it returns false if code inside user input", async (t) => {
  t.same(false, shouldReturnEarly("a()", "a()"));
});
