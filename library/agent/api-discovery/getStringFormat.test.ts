import t from "tap";
import { getStringFormat } from "./getStringFormat";

t.test("it is a date string", async (t) => {
  t.same(getStringFormat("2021-01-01"), "date");
  t.same(getStringFormat("2021-12-31"), "date");
});

t.test("it is a date time string", async (t) => {
  t.same(getStringFormat("1985-04-12T23:20:50.52Z"), "date-time");
  t.same(getStringFormat("1996-12-19T16:39:57-08:00"), "date-time");
  t.same(getStringFormat("1990-12-31T23:59:60Z"), "date-time");
  t.same(getStringFormat("1990-12-31T15:59:60-08:00"), "date-time");
  t.same(getStringFormat("1937-01-01T12:00:27.87+00:20"), "date-time");
});
