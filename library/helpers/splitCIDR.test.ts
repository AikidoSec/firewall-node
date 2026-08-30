import * as t from "tap";
import { splitCIDR } from "./splitCIDR";

t.test("it splits an IP with a CIDR suffix", async (t) => {
  t.same(splitCIDR("10.0.0.0/8"), ["10.0.0.0", 8]);
  t.same(splitCIDR("192.168.0.0/16"), ["192.168.0.0", 16]);
  t.same(splitCIDR("2001:db8::/32"), ["2001:db8::", 32]);
});

t.test(
  "it defaults to a single-host prefix when no suffix is present",
  async (t) => {
    t.same(splitCIDR("127.0.0.1"), ["127.0.0.1", 32]);
    t.same(splitCIDR("::1"), ["::1", 128]);
  }
);

t.test("it handles boundary suffix values", async (t) => {
  t.same(splitCIDR("0.0.0.0/0"), ["0.0.0.0", 0]);
  t.same(splitCIDR("::/0"), ["::", 0]);
  t.same(splitCIDR("127.0.0.1/32"), ["127.0.0.1", 32]);
  t.same(splitCIDR("::1/128"), ["::1", 128]);
});
