import * as t from "tap";
import { isPrivateIP } from "./isPrivateIP";

t.test("private IPv6 addresses with a zone", async (t) => {
  t.equal(isPrivateIP("fe80::1%eth0"), true);
  t.equal(isPrivateIP("fe80::1%dummy0"), true);
  t.equal(isPrivateIP("::1%lo"), true);
});

t.test("reserved IPv6 addresses", async (t) => {
  t.equal(isPrivateIP("::"), true);
  t.equal(isPrivateIP("::1"), true);
  t.equal(isPrivateIP("fc00::"), true);
  t.equal(isPrivateIP("fd12:3456:789a:1::42"), true);
  t.equal(isPrivateIP("fdff:ffff:ffff:ffff:ffff:ffff:ffff:fffe"), true);
  t.equal(isPrivateIP("fe80:0:0:0:a1b2:c3d4:e5f6:789"), true);
  t.equal(isPrivateIP("febf:1234::abcd"), true);
  t.equal(isPrivateIP("100::dead:beef"), true);
  t.equal(isPrivateIP("100:0:0:0:ffff:1234:5678:9abc"), true);
  t.equal(isPrivateIP("2001:db8:1234:5678::9"), true);
  t.equal(isPrivateIP("2001:db8:ffff:ffff:ffff:ffff:ffff:fffe"), true);
  t.equal(isPrivateIP("3fff:abc:1234::5678"), true);
  t.equal(isPrivateIP("3fff:fff:ffff:ffff:ffff:ffff:ffff:fffe"), true);
  t.equal(isPrivateIP("fec0::1:2:3"), true);
  t.equal(isPrivateIP("feff:abcd:1234::5"), true);
});
