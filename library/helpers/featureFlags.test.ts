import t from "tap";
import { isFeatureEnabled } from "./featureFlags";

t.test("isFeatureEnabled", async (t) => {
  t.equal(isFeatureEnabled("foo"), true);
  process.env.TAP = "0";
  t.equal(isFeatureEnabled("foo"), false);
  process.env.AIKIDO_FEATURE_FOO = "true";
  t.equal(isFeatureEnabled("foo"), true);
  process.env.AIKIDO_FEATURE_FOO = "1";
  t.equal(isFeatureEnabled("foo"), true);
  process.env.AIKIDO_FEATURE_FOO = "false";
  t.equal(isFeatureEnabled("foo"), false);
  process.env.TAP = "1";
  t.equal(isFeatureEnabled("foo"), true);
});
