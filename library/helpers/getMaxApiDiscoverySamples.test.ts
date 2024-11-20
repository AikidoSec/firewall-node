import * as t from "tap";
import { getMaxApiDiscoverySamples } from "./getMaxApiDiscoverySamples";

t.test("it works", async (t) => {
  t.same(getMaxApiDiscoverySamples(), 10);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "5";
  t.same(getMaxApiDiscoverySamples(), 5);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "0";
  t.same(getMaxApiDiscoverySamples(), 0);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "abc";
  t.same(getMaxApiDiscoverySamples(), 10);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "-1";
  t.same(getMaxApiDiscoverySamples(), 10);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "10";
  t.same(getMaxApiDiscoverySamples(), 10);
  process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES = "11";
  t.same(getMaxApiDiscoverySamples(), 11);
});
