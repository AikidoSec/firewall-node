import * as t from "tap";
import shouldEnableFirewall from "./shouldEnableFirewall";

t.test("disabled by default", async () => {
  t.same(shouldEnableFirewall(), false);
});

t.test("works with AIKIDO_DEBUG", async () => {
  process.env.AIKIDO_DEBUG = "1";
  t.same(shouldEnableFirewall(), true);
  process.env.AIKIDO_DEBUG = "true";
  t.same(shouldEnableFirewall(), true);
  process.env.AIKIDO_DEBUG = "";
  t.same(shouldEnableFirewall(), false);
});

t.test("works with AIKIDO_BLOCK", async () => {
  process.env.AIKIDO_BLOCK = "1";
  t.same(shouldEnableFirewall(), true);
  process.env.AIKIDO_BLOCK = "true";
  t.same(shouldEnableFirewall(), true);
  process.env.AIKIDO_BLOCK = "";
  t.same(shouldEnableFirewall(), false);
});

t.test("works with AIKIDO_TOKEN", async () => {
  process.env.AIKIDO_TOKEN = "abc123";
  t.same(shouldEnableFirewall(), true);
  process.env.AIKIDO_TOKEN = "";
  t.same(shouldEnableFirewall(), false);
});

t.test("it works if multiple are set", async () => {
  process.env.AIKIDO_DEBUG = "1";
  process.env.AIKIDO_BLOCK = "1";
  t.same(shouldEnableFirewall(), true);
});
