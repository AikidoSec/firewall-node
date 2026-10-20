import * as t from "tap";
import { isFeatureEnabled } from "./featureFlags";

t.test("isFeatureEnabled", async (t) => {
  t.equal(isFeatureEnabled("foo"), true);
  process.env.AIKIDO_UNIT_TESTS = "0";
  t.equal(isFeatureEnabled("foo"), false);
  process.env.AIKIDO_FEATURE_FOO = "true";
  t.equal(isFeatureEnabled("foo"), true);
  process.env.AIKIDO_FEATURE_FOO = "1";
  t.equal(isFeatureEnabled("foo"), true);
  process.env.AIKIDO_FEATURE_FOO = "false";
  t.equal(isFeatureEnabled("foo"), false);
  process.env.AIKIDO_UNIT_TESTS = "1";
  t.equal(isFeatureEnabled("foo"), true);
});
