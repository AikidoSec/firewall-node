import * as t from "tap";
import isDateTimeString from "./isDateTimeString";

t.test("it is a date time string", async (t) => {
  t.same(isDateTimeString("1985-04-12T23:20:50.52Z"), true);
  t.same(isDateTimeString("1996-12-19T16:39:57-08:00"), true);
  t.same(isDateTimeString("1990-12-31T23:59:60Z"), true);
  t.same(isDateTimeString("1990-12-31T15:59:60-08:00"), true);
  t.same(isDateTimeString("1937-01-01T12:00:27.87+00:20"), true);
});

t.test("it is not a date time string", async (t) => {
  t.same(isDateTimeString(""), false);
  t.same(isDateTimeString("2021-11-25"), false);
  t.same(isDateTimeString("2021-11-25T"), false);
  t.same(isDateTimeString("2021-11-25T00:00:00"), false);
  t.same(isDateTimeString("2021-13-05T00:00:00+00:00"), false);
  t.same(isDateTimeString("2021-999-05T00:00:00+00:00"), false);
  t.same(isDateTimeString("2021-02-05T00:90:00+00:00"), false);
  t.same(isDateTimeString("2021-02-05T00:00:00+90:00"), false);
  t.same(isDateTimeString("2021-02-05T00:00:00+00:000000000"), false);
});
