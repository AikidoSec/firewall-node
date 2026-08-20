import * as t from "tap";
import {
  trustProxy,
  getTrustProxyConfig,
  clearTrustProxyCache,
} from "./trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
  clearTrustProxyCache();
});

t.test("the default is true", async () => {
  t.equal(trustProxy(), true);
  t.same(getTrustProxyConfig(), { type: "boolean", value: true });
});

t.test("trust proxy set to false", async () => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  t.equal(trustProxy(), false);
  t.same(getTrustProxyConfig(), { type: "boolean", value: false });
});

t.test("trust proxy set to true", async () => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  t.equal(trustProxy(), true);
  t.same(getTrustProxyConfig(), { type: "boolean", value: true });
});

t.test("trust proxy set to a positive integer", async () => {
  process.env.AIKIDO_TRUST_PROXY = "2";
  const config = getTrustProxyConfig();
  t.equal(config.type, "count");
  t.equal((config as { type: "count"; value: number }).value, 2);
  t.equal(trustProxy(), true);
});

t.test("trust proxy set to 1", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1";
  const config = getTrustProxyConfig();
  t.equal(config.type, "count");
  t.equal((config as { type: "count"; value: number }).value, 1);
});

t.test("trust proxy set to 0", async () => {
  process.env.AIKIDO_TRUST_PROXY = "0";
  const config = getTrustProxyConfig();
  t.equal(config.type, "boolean");
  t.equal((config as { type: "boolean"; value: boolean }).value, false);
  t.equal(trustProxy(), false);
});

t.test("trust proxy set to a single CIDR range", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32";
  const config = getTrustProxyConfig();
  t.equal(config.type, "cidr");
  t.equal(trustProxy(), true);
});

t.test("trust proxy set to multiple CIDR ranges", async () => {
  process.env.AIKIDO_TRUST_PROXY = "1.2.3.4/32, 5.6.7.0/24";
  const config = getTrustProxyConfig();
  t.equal(config.type, "cidr");
});

t.test("result is cached after first call", async () => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  const a = getTrustProxyConfig();
  delete process.env.AIKIDO_TRUST_PROXY;
  const b = getTrustProxyConfig();
  t.equal(a, b);
});

t.test("cache is cleared by clearTrustProxyCache", async () => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  const a = getTrustProxyConfig();
  clearTrustProxyCache();
  delete process.env.AIKIDO_TRUST_PROXY;
  const b = getTrustProxyConfig();
  t.ok(a !== b);
  t.equal((b as { type: "boolean"; value: boolean }).value, true);
});
