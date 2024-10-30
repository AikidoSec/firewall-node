import * as t from "tap";
import isDateString from "./isDateString";

t.test("it is a date string", async (t) => {
  t.same(isDateString("2021-01-01"), true);
  t.same(isDateString("2021-12-31"), true);
});

t.test("it is not a date string", async (t) => {
  t.same(isDateString("2021-01-32"), false);
  t.same(isDateString("-2021-01-20"), false);
  t.same(isDateString(""), false);
  t.same(isDateString("2021-01-01T00:00:00Z"), false);
  t.same(isDateString("01"), false);
  t.same(isDateString("2001-ab-02"), false);
});
