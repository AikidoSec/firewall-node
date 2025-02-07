import * as t from "tap";
import isFQDN from "./isFQDN";

t.test("is a valid domain", async (t) => {
  t.same(isFQDN("example.com"), true);
  t.same(isFQDN("sub.example.com"), true);
  t.same(isFQDN("sub.sub.example.com"), true);
  t.same(isFQDN("tkössler.de"), true);
  t.same(isFQDN("xn--tkssler-b1a.de"), true);
});

t.test("is not a valid domain", async (t) => {
  t.same(isFQDN("example"), false);
  t.same(isFQDN("example."), false);
  t.same(isFQDN("example.a"), false);
  t.same(isFQDN("example..com"), false);
  t.same(isFQDN("example.com."), false);
  t.same(isFQDN("example.com.."), false);
  t.same(isFQDN("example. com"), false);
  t.same(isFQDN("example.123"), false);
  t.same(isFQDN("e".repeat(64) + ".com"), false);
  t.same(isFQDN("ｇ.com"), false);
  t.same(isFQDN(""), false);
  t.same(isFQDN("-example.com"), false);
});
