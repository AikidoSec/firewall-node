/* eslint-disable import/no-unused-modules */
import { runWithContext } from "./agent/Context";
import { protect, lambda, cloudFunction } from "./agent/protect";
import { preventPrototypePollution } from "./vulnerabilities/prototype-pollution/preventPrototypePollution";

export {
  protect,
  lambda,
  cloudFunction,
  preventPrototypePollution,
  runWithContext,
};
