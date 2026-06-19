import * as t from "tap";
import { getTrustedProxyCount } from "./trustedProxyCount";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUSTED_PROXY_COUNT;
});

t.test("defaults to 1 when env var is not set", async (t) => {
  t.equal(getTrustedProxyCount(), 1);
});

t.test("returns the configured count", async (t) => {
  process.env.AIKIDO_TRUSTED_PROXY_COUNT = "2";
  t.equal(getTrustedProxyCount(), 2);

  process.env.AIKIDO_TRUSTED_PROXY_COUNT = "5";
  t.equal(getTrustedProxyCount(), 5);
});

t.test("falls back to 1 for invalid values", async (t) => {
  for (const val of ["0", "-1", "abc", "1.5", ""]) {
    process.env.AIKIDO_TRUSTED_PROXY_COUNT = val;
    t.equal(getTrustedProxyCount(), 1, `"${val}" should fall back to 1`);
  }
});
