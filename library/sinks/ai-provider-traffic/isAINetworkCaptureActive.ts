import { envToBool } from "../../helpers/envToBool";
import { isVersionGreaterOrEqual } from "../../helpers/isVersionGreaterOrEqual";

export function isAINetworkCaptureActive(): boolean {
  return (
    envToBool(process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE) &&
    // undici 7.11.0 added the undici:request:bodyChunkReceived channel
    isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
  );
}
