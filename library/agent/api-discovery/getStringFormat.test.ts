import * as t from "tap";
import { getStringFormat } from "./getStringFormat";

t.test("it is not a known format", async (t) => {
  t.same(getStringFormat(""), undefined);
  t.same(getStringFormat("abc"), undefined);
  t.same(getStringFormat("2021-11-25T"), undefined);
  t.same(getStringFormat("2021-11-25T00:00:00"), undefined);
  t.same(getStringFormat("test".repeat(64)), undefined);
});

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

t.test("it is a UUID string", async (t) => {
  t.same(getStringFormat("550e8400-e29b-41d4-a716-446655440000"), "uuid");
  t.same(getStringFormat("00000000-0000-0000-0000-000000000000"), "uuid");
});

t.test("it is an IPv4 string", async (t) => {
  t.same(getStringFormat("127.0.0.1"), "ipv4");
  t.same(getStringFormat("1.2.3.4"), "ipv4");
});

t.test("it is an IPv6 string", async (t) => {
  t.same(getStringFormat("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), "ipv6");
  t.same(getStringFormat("2001:db8:0:0:0:8a2e:370:7334"), "ipv6");
});

t.test("it is an email string", async (t) => {
  t.same(getStringFormat("hello@example.com"), "email");
  t.same(getStringFormat("@"), undefined);
  t.same(getStringFormat("@a"), undefined);
  t.same(getStringFormat("a@"), undefined);

  // Technically valid but unsupported
  t.same(getStringFormat("ö@ö.de"), undefined);
});

t.test("it is a URI string", async (t) => {
  t.same(getStringFormat("http://example.com"), "uri");
  t.same(getStringFormat("https://example.com"), "uri");
  t.same(getStringFormat("ftp://example.com"), "uri");
});
