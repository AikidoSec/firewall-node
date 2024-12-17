import * as t from "tap";
import { Address } from "./Address";

t.test("it works", async (t) => {
  t.same(new Address("1.2.3.5").isIPv4(), true);
  t.same(new Address("::1").isIPv4(), false);
  t.same(new Address("::1").isIPv6(), true);

  t.same(new Address("1.2.3.4").compare(new Address("1.2.3.5")), -1);
  t.same(new Address("1.2.3.4").compare(new Address("1.2.3.4")), 0);
  t.same(new Address("1.2.3.4").compare(new Address("1.2.3.4").duplicate()), 0);

  t.same(new Address("1.2.3.4").bytes(), [1, 2, 3, 4]);
  t.same(new Address().bytes(), []);
  t.same(new Address("1.2.3.4").setBytes([3]).bytes(), []);

  t.same(new Address("1.2.3.4").equals(new Address("1.2.3.4")), true);
  t.same(new Address("1.2.3.4").equals(new Address("1.2.3.5")), false);

  t.same(new Address().compare(new Address()), null);
  t.same(new Address("1.2.3.4").compare(new Address()), null);
  t.ok(new Address().applySubnetMask(0));

  t.same(new Address().increase(0).bytes(), []);
});
