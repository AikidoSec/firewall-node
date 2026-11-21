import * as t from "tap";
import { mapIPv4WithIPv6Prefix } from "./mapIPv4WithIPv6Prefix";

t.test("it embeds a single IPv4 address behind a prefix", async (t) => {
  t.equal(
    mapIPv4WithIPv6Prefix("127.0.0.1", "64:ff9b::", 96),
    "64:ff9b::127.0.0.1/128"
  );
  t.equal(mapIPv4WithIPv6Prefix("10.0.0.1", "::", 96), "::10.0.0.1/128");
});

t.test("it adjusts the prefix length for an IPv4 CIDR range", async (t) => {
  t.equal(
    mapIPv4WithIPv6Prefix("10.0.0.0/8", "64:ff9b::", 96),
    "64:ff9b::10.0.0.0/104"
  );
  t.equal(
    mapIPv4WithIPv6Prefix("192.168.0.0/16", "64:ff9b:1::", 96),
    "64:ff9b:1::192.168.0.0/112"
  );
});
