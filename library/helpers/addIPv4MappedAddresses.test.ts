import * as t from "tap";
import { addIPv4MappedAddresses } from "./addIPv4MappedAddresses";

t.test("it adds IPv4-mapped IPv6 addresses", async (t) => {
  t.same(
    addIPv4MappedAddresses([
      "1.2.3.4",
      "23.45.67.89/24",
      "2606:2800:220:1:248:1893:25c8:1946",
      "2001:0db9:abcd:1234::/64",
    ]),
    [
      "1.2.3.4",
      "23.45.67.89/24",
      "2606:2800:220:1:248:1893:25c8:1946",
      "2001:0db9:abcd:1234::/64",
      "::ffff:1.2.3.4/128",
      "::ffff:23.45.67.89/120",
    ]
  );
});

t.test("it handles empty array", async (t) => {
  t.same(addIPv4MappedAddresses([]), []);
});

t.test("it handles only IPv6 addresses", async (t) => {
  t.same(addIPv4MappedAddresses(["2001:db8::1", "::1"]), [
    "2001:db8::1",
    "::1",
  ]);
});

t.test("it handles only IPv4 addresses", async (t) => {
  t.same(addIPv4MappedAddresses(["1.2.3.4", "5.6.7.8"]), [
    "1.2.3.4",
    "5.6.7.8",
    "::ffff:1.2.3.4/128",
    "::ffff:5.6.7.8/128",
  ]);
});
