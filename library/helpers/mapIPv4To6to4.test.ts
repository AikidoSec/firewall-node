import * as t from "tap";
import { mapIPv4To6to4 } from "./mapIPv4To6to4";

t.test("it maps a single IPv4 address to its 6to4 form", async (t) => {
  t.equal(mapIPv4To6to4("127.0.0.1"), "2002:7f00:1::/48");
  t.equal(mapIPv4To6to4("10.0.0.1"), "2002:a00:1::/48");
  t.equal(mapIPv4To6to4("192.168.0.1"), "2002:c0a8:1::/48");
  t.equal(mapIPv4To6to4("8.8.8.8"), "2002:808:808::/48");
});

t.test("it adjusts the prefix length for an IPv4 CIDR range", async (t) => {
  t.equal(mapIPv4To6to4("10.0.0.0/8"), "2002:a00:0::/24");
  t.equal(mapIPv4To6to4("192.168.0.0/16"), "2002:c0a8:0::/32");
});

t.test("it does not pad hex groups that have leading zeros", async (t) => {
  // JS drops leading zeros when converting to hex (e.g. 1 -> "1", not "0001"),
  // which is still valid, unambiguous IPv6 group notation.
  t.equal(mapIPv4To6to4("0.1.0.1"), "2002:1:1::/48");
  t.equal(mapIPv4To6to4("0.0.0.0/0"), "2002:0:0::/16");
});
