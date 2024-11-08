import * as t from "tap";
import { addIPAddressToBlocklist } from "./addIPAddressToBlocklist";
import { BlockList } from "net";

t.test("valid IPs", async () => {
  const blocklist = new BlockList();
  t.same(addIPAddressToBlocklist("1.2.3.4", blocklist), true);
  t.same(blocklist.check("1.2.3.4"), true);

  t.same(addIPAddressToBlocklist("fd00:ec2::254", blocklist), true);
  t.same(blocklist.check("fd00:ec2::254", "ipv6"), true);

  t.same(addIPAddressToBlocklist("192.168.2.1/24", blocklist), true);
  t.same(blocklist.check("192.168.2.1"), true);
  t.same(blocklist.check("192.168.2.240"), true);

  t.same(addIPAddressToBlocklist("fd00:124::1/64", blocklist), true);
  t.same(blocklist.check("fd00:124::1", "ipv6"), true);
  t.same(blocklist.check("fd00:124::f", "ipv6"), true);
  t.same(blocklist.check("fd00:124::ff13", "ipv6"), true);

  t.same(addIPAddressToBlocklist("fd00:f123::1/128", blocklist), true);
  t.same(blocklist.check("fd00:f123::1", "ipv6"), true);

  t.same(blocklist.check("2.3.4.5"), false);
  t.same(blocklist.check("fd00:125::ff13", "ipv6"), false);
  t.same(blocklist.check("fd00:f123::2", "ipv6"), false);
});

t.test("invalid IPs", async () => {
  const blocklist = new BlockList();
  t.same(addIPAddressToBlocklist("192.168.2.2.1/24", blocklist), false);
  t.same(addIPAddressToBlocklist("test", blocklist), false);
  t.same(addIPAddressToBlocklist("", blocklist), false);
  t.same(addIPAddressToBlocklist("192.168.2.1/64", blocklist), false);
  t.same(addIPAddressToBlocklist("fd00:124::1/129", blocklist), false);
  t.same(addIPAddressToBlocklist("fd00:124::1/0", blocklist), false);
  t.same(addIPAddressToBlocklist("fd00:124::1/test", blocklist), false);
});
