import * as t from "tap";
import { addIPv4TransitionAddresses } from "./addIPv4TransitionAddresses";

t.test("it adds transition mechanism addresses for IPv4 entries", async (t) => {
  t.same(addIPv4TransitionAddresses(["127.0.0.1"]), [
    "127.0.0.1",
    "64:ff9b::127.0.0.1/128",
    "64:ff9b:1::127.0.0.1/128",
    "::127.0.0.1/128",
    "2002:7f00:1::/48",
  ]);
});

t.test("it adjusts the prefix length for an IPv4 CIDR range", async (t) => {
  t.same(addIPv4TransitionAddresses(["10.0.0.0/8"]), [
    "10.0.0.0/8",
    "64:ff9b::10.0.0.0/104",
    "64:ff9b:1::10.0.0.0/104",
    "::10.0.0.0/104",
    "2002:a00:0::/24",
  ]);
});

t.test("it handles empty array", async (t) => {
  t.same(addIPv4TransitionAddresses([]), []);
});

t.test("it handles only IPv6 addresses", async (t) => {
  t.same(addIPv4TransitionAddresses(["2001:db8::1", "::1"]), [
    "2001:db8::1",
    "::1",
  ]);
});

t.test("it handles a mix of IPv4 and IPv6 addresses", async (t) => {
  t.same(addIPv4TransitionAddresses(["2001:db8::1", "127.0.0.1", "::1"]), [
    "2001:db8::1",
    "127.0.0.1",
    "::1",
    "64:ff9b::127.0.0.1/128",
    "64:ff9b:1::127.0.0.1/128",
    "::127.0.0.1/128",
    "2002:7f00:1::/48",
  ]);
});
