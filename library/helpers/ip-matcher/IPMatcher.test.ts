import * as t from "tap";
import { IPMatcher } from "./IPMatcher";

t.test("check with single Ipv4s", async (t) => {
  const input = [
    "192.168.0.0/32",
    "192.168.0.3/32",
    "192.168.0.24/32",
    "192.168.0.52/32",
    "192.168.0.123/32",
    "192.168.0.124/32",
    "192.168.0.125/32",
    "192.168.0.170/32",
    "192.168.0.171/32",
    "192.168.0.222/32",
    "192.168.0.234/32",
    "192.168.0.255/32",
  ];
  const matcher = new IPMatcher(input);
  t.same(matcher.has("192.168.0.254"), false);
  t.same(matcher.has("192.168.0.1"), false);
  t.same(matcher.has("192.168.0.255"), true);
  t.same(matcher.has("192.168.0.24"), true);
});

t.test("it works with ranges", async (t) => {
  const input = [
    "192.168.0.0/24",
    "192.168.0.3/32",
    "192.168.0.24/32",
    "192.168.0.52/32",
    "192.168.0.123/32",
    "192.168.0.124/32",
    "192.168.0.125/32",
    "192.168.0.170/32",
    "192.168.0.171/32",
    "192.168.0.222/32",
    "192.168.0.234/32",
    "192.168.0.255/32",
  ];
  const matcher = new IPMatcher(input);
  t.same(matcher.has("192.168.0.254"), true);
  t.same(matcher.has("10.0.0.1"), false);
  t.same(matcher.has("192.168.0.234"), true);
});

t.test("it works with invalid ranges", async (t) => {
  const input = [
    "192.168.0.0/24",
    "192.168.0.3/32",
    "192.168.0.24/32",
    "192.168.0.52/32",
    "foobar",
    "0.a.0.0/32",
    "123.123.123.123/1999",
    "",
    ",,,",
    "192.168.0.124/32",
    "192.168.0.125/32",
    "192.168.0.170/32",
    "192.168.0.171/32",
    "192.168.0.222/32",
    "192.168.0.234/32",
    "192.168.0.255",
  ];
  const matcher = new IPMatcher(input);
  t.same(matcher.has("192.168.0.254"), true);
  t.same(matcher.has("foobar"), false);
  t.same(matcher.has("192.168.0.222"), true);
  t.same(matcher.has("192.168.0.1"), true);
  t.same(matcher.has("10.0.0.1"), false);
  t.same(matcher.has("192.168.0.255"), true);
  t.same(matcher.has(""), false);
  t.same(matcher.has("1"), false);
  t.same(matcher.has("192.168.0.1/32"), true);
});

t.test("it works with empty ranges", async (t) => {
  const input: string[] = [];
  const matcher = new IPMatcher(input);
  t.same(matcher.has("192.168.2.1"), false);
  t.same(matcher.has("foobar"), false);
});

t.test("it works with ipv6 ranges", async (t) => {
  const input = [
    "2002:db8::/32",
    "2001:db8::1/128",
    "2001:db8::2/128",
    "2001:db8::3/128",
    "2001:db8::4/128",
    "2001:db8::5/128",
    "2001:db8::6/128",
    "2001:db8::7/128",
    "2001:db8::8/128",
    "2001:db8::9/128",
    "2001:db8::a/128",
    "2001:db8::b/128",
    "2001:db8::c/128",
    "2001:db8::d/128",
    "2001:db8::e/128",
    "[2001:db8::f]",
    "2001:db9::abc",
  ];
  const matcher = new IPMatcher(input);
  t.same(matcher.has("2001:db8::1"), true);
  t.same(matcher.has("2001:db8::0"), false);
  t.same(matcher.has("2001:db8::f"), true);
  t.same(matcher.has("[2001:db8::f]"), true);
  t.same(matcher.has("2001:db8::10"), false);
  t.same(matcher.has("2002:db8::1"), true);
  t.same(matcher.has("2002:db8::2f:2"), true);
  t.same(matcher.has("2001:db9::abc"), true);
});

t.test("mix ipv4 and ipv6", async (t) => {
  const input = ["2002:db8::/32", "10.0.0.0/8"];

  const matcher = new IPMatcher(input);
  t.same(matcher.has("2001:db8::1"), false);
  t.same(matcher.has("2001:db8::0"), false);
  t.same(matcher.has("2002:db8::1"), true);
  t.same(matcher.has("10.0.0.1"), true);
  t.same(matcher.has("10.0.0.255"), true);
  t.same(matcher.has("192.168.1.1"), false);
});

t.test("add ips later", async (t) => {
  const input = ["2002:db8::/32", "10.0.0.0/8"];

  const matcher = new IPMatcher();

  t.same(matcher.has("2001:db8::0"), false);
  t.same(matcher.has("2002:db8::1"), false);

  for (const ip of input) {
    matcher.add(ip);
  }

  t.same(matcher.has("2001:db8::1"), false);
  t.same(matcher.has("2001:db8::0"), false);
  t.same(matcher.has("2002:db8::1"), true);
  t.same(matcher.has("10.0.0.1"), true);
  t.same(matcher.has("10.0.0.255"), true);
  t.same(matcher.has("192.168.1.1"), false);
});

t.test("strange ips", async (t) => {
  const input = ["::ffff:0.0.0.0", "::ffff:0:0:0:0", "::ffff:127.0.0.1"];

  const matcher = new IPMatcher(input);

  t.same(matcher.has("::ffff:0.0.0.0"), true);
  t.same(matcher.has("::ffff:127.0.0.1"), true);
  t.same(matcher.has("::ffff:123"), false);
  t.same(matcher.has("2001:db8::1"), false);
  t.same(matcher.has("[::ffff:0.0.0.0]"), true);
  t.same(matcher.has("::ffff:0:0:0:0"), true);
});

t.test("Different cidr ranges", async (t) => {
  t.same(new IPMatcher(["123.2.0.2/0"]).has("1.1.1.1"), true);
  t.same(new IPMatcher(["123.2.0.2/1"]).has("1.1.1.1"), true);
  t.same(new IPMatcher(["123.2.0.2/2"]).has("1.1.1.1"), false);
  t.same(new IPMatcher(["123.2.0.2/3"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/4"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/5"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/6"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/7"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/8"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/9"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/10"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/11"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/12"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/13"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/14"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/15"]).has("123.3.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/16"]).has("123.3.0.1"), false);
  t.same(new IPMatcher(["123.2.0.2/17"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/18"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/19"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/20"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/21"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/22"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/23"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/24"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/25"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/26"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/27"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/29"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/30"]).has("123.2.0.1"), true);
  t.same(new IPMatcher(["123.2.0.2/31"]).has("123.2.0.1"), false);
  t.same(new IPMatcher(["123.2.0.2/32"]).has("123.2.0.2"), true);
});
