import * as t from "tap";
import { IPMatcher } from "./ip-matcher/IPMatcher";
import { ipMatcherHasWithMappedCheck } from "./ipMatcherHasWithMappedCheck";

t.test("it matches direct IPv4", async (t) => {
  const matcher = new IPMatcher(["192.0.2.1"]);
  t.same(ipMatcherHasWithMappedCheck(matcher, "192.0.2.1"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "192.0.2.2"), false);
});

t.test("it matches IPv4-mapped IPv6 against IPv4 in list", async (t) => {
  const matcher = new IPMatcher(["192.0.2.1"]);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.2.1"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:c000:201"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.2.2"), false);
});

t.test("it matches IPv4-mapped IPv6 against IPv4 CIDR range", async (t) => {
  const matcher = new IPMatcher(["192.0.2.0/24"]);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.2.1"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.2.255"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.3.1"), false);
});

t.test("it matches direct IPv6", async (t) => {
  const matcher = new IPMatcher(["2001:db8::1"]);
  t.same(ipMatcherHasWithMappedCheck(matcher, "2001:db8::1"), true);
  t.same(ipMatcherHasWithMappedCheck(matcher, "2001:db8::2"), false);
});

t.test("it matches explicit IPv4-mapped in list", async (t) => {
  const matcher = new IPMatcher(["::ffff:192.0.2.1"]);
  t.same(ipMatcherHasWithMappedCheck(matcher, "::ffff:192.0.2.1"), true);
});
