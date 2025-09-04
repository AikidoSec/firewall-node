import * as t from "tap";
import { trustProxy } from "./trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

t.test("the default is true", async () => {
  t.equal(trustProxy(), { trust: "all" });
});

t.test("trust proxy set to false", async () => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  t.equal(trustProxy(), { trust: "none" });
});

t.test("trust proxy set to true", async () => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  t.equal(trustProxy(), { trust: "all" });
});

t.test("trust proxy set to single IP", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4";
  t.same(trustProxy(), { trust: ["1.2.3.4"] });
});

t.test("trust proxy set to network range", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.0/32";
  t.same(trustProxy(), { trust: ["1.2.3.0/32"] });
});

t.test("trust proxy set to mix of IPs and network ranges", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4, 1.2.3.0/32";
  t.same(trustProxy(), { trust: ["1.2.3.4", "1.2.3.0/32"] });
});
