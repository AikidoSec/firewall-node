import * as t from "tap";
import { network } from "./parse";

t.test("it works", async (t) => {
  t.same(network("192.168.2.1/24"), { bytes: [192, 168, 2, 1], cidr: 24 });
  t.same(network("192.168.2.1/abcde"), null);
  t.same(network("192.168.2.1/24/test"), null);
  t.same(network("::1"), {
    bytes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    cidr: 128,
  });
});
