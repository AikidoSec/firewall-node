import * as t from "tap";
import { extractIPv4FromMapped } from "./extractIPv4FromMapped";

t.test("it extracts IPv4 from ::ffff:x.x.x.x format", async (t) => {
  t.same(extractIPv4FromMapped("::ffff:192.0.2.1"), "192.0.2.1");
  t.same(extractIPv4FromMapped("::ffff:127.0.0.1"), "127.0.0.1");
  t.same(extractIPv4FromMapped("::ffff:10.0.0.1"), "10.0.0.1");
  t.same(extractIPv4FromMapped("::ffff:0.0.0.0"), "0.0.0.0");
  t.same(extractIPv4FromMapped("::ffff:255.255.255.255"), "255.255.255.255");
});

t.test("it extracts IPv4 from hex format", async (t) => {
  // 192.0.2.1 = c0.00.02.01 = c000:0201
  t.same(extractIPv4FromMapped("::ffff:c000:201"), "192.0.2.1");
  // 127.0.0.1 = 7f.00.00.01 = 7f00:0001
  t.same(extractIPv4FromMapped("::ffff:7f00:1"), "127.0.0.1");
  // 10.0.0.1 = 0a.00.00.01 = 0a00:0001
  t.same(extractIPv4FromMapped("::ffff:a00:1"), "10.0.0.1");
});

t.test("it extracts IPv4 from fully expanded format", async (t) => {
  t.same(
    extractIPv4FromMapped("0000:0000:0000:0000:0000:ffff:c000:0201"),
    "192.0.2.1"
  );
  t.same(extractIPv4FromMapped("0:0:0:0:0:ffff:c000:201"), "192.0.2.1");
});

t.test("it returns null for non-mapped IPv6", async (t) => {
  t.same(extractIPv4FromMapped("2001:db8::1"), null);
  t.same(extractIPv4FromMapped("::1"), null);
  t.same(extractIPv4FromMapped("fe80::1"), null);
});

t.test("it returns null for plain IPv4", async (t) => {
  t.same(extractIPv4FromMapped("192.0.2.1"), null);
  t.same(extractIPv4FromMapped("127.0.0.1"), null);
});

t.test("it returns null for invalid input", async (t) => {
  t.same(extractIPv4FromMapped(""), null);
  t.same(extractIPv4FromMapped("invalid"), null);
});
