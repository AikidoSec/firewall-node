import * as t from "tap";
import mapIPv4ToIPv6 from "./mapIPv4ToIPv6";

t.test("it works", async (t) => {
  t.equal(mapIPv4ToIPv6("127.0.0.0"), "::ffff:127.0.0.0/128");
  t.equal(mapIPv4ToIPv6("127.0.0.0/8"), "::ffff:127.0.0.0/104");
  t.equal(mapIPv4ToIPv6("10.0.0.0"), "::ffff:10.0.0.0/128");
  t.equal(mapIPv4ToIPv6("10.0.0.0/8"), "::ffff:10.0.0.0/104");
  t.equal(mapIPv4ToIPv6("10.0.0.1"), "::ffff:10.0.0.1/128");
  t.equal(mapIPv4ToIPv6("10.0.0.1/8"), "::ffff:10.0.0.1/104");
  t.equal(mapIPv4ToIPv6("192.168.0.0/16"), "::ffff:192.168.0.0/112");
  t.equal(mapIPv4ToIPv6("172.16.0.0/12"), "::ffff:172.16.0.0/108");
});
