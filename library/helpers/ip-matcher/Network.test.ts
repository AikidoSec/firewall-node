import * as t from "tap";
import { Network } from "./Network";

t.test("it works", async (t) => {
  t.same(new Network().cidr(), Number.NaN);
  t.same(new Network().setCIDR(0).isValid(), false);
  t.same(new Network("192.168.2.1/24").isValid(), true);
  t.same(new Network("192.168.2.1/24").setCIDR(-1).isValid(), false);
  t.same(new Network().compare(new Network()), null);
  t.same(new Network("192.168.2.1/24").compare(new Network()), null);

  t.same(new Network().contains(new Network()), false);
  t.same(new Network("192.168.2.1/24").contains(new Network()), false);
  t.same(
    new Network("192.168.2.1/24").contains(new Network("192.168.2.1/32")),
    true
  );
});
