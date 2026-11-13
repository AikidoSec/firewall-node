import * as dc from "diagnostics_channel";
import { envToBool } from "../helpers/envToBool";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";

let enabled: boolean | undefined;

function compute(): boolean {
  if (!envToBool(process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE)) {
    return false;
  }

  if (
    typeof dc.subscribe !== "function" ||
    !isVersionGreaterOrEqual("16.17.0", getSemverNodeVersion())
  ) {
    return false;
  }

  if (typeof process.versions.undici !== "string") {
    return false;
  }

  return isVersionGreaterOrEqual("7.11.0", process.versions.undici);
}

export function isAIProviderTrafficCaptureEnabled(): boolean {
  if (enabled === undefined) {
    enabled = compute();
  }
  return enabled;
}
