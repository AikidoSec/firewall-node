import { getInstance } from "../agent/AgentSingleton";
import {
  Context,
  getContext,
  PAYLOAD_DEPTH_CHECK,
  updateContext,
} from "../agent/Context";
import { isPayloadTooDeep } from "./isPayloadTooDeep";

export const PAYLOAD_TOO_DEEP_MESSAGE =
  "This request was aborted by Aikido firewall because the body exceeded the maximum allowed depth.";

export class PayloadTooDeepError extends Error {
  constructor() {
    super(PAYLOAD_TOO_DEEP_MESSAGE);
    this.name = "PayloadTooDeepError";
  }
}

export function shouldBlockRequestForPayloadDepth(): boolean {
  const context = getContext() as Context | undefined;
  const agent = getInstance();
  const maxDepth = agent?.getConfig().getMaxPayloadDepth();

  if (
    !context ||
    !agent ||
    maxDepth === undefined ||
    (context.body === undefined && context.rawBody === undefined)
  ) {
    return false;
  }

  const cached = context[PAYLOAD_DEPTH_CHECK];
  const tooDeep =
    cached &&
    cached.body === context.body &&
    cached.rawBody === context.rawBody &&
    cached.maxDepth === maxDepth
      ? cached.tooDeep
      : (context.body !== undefined &&
          isPayloadTooDeep(context.body, maxDepth)) ||
        (context.rawBody !== undefined &&
          isPayloadTooDeep(context.rawBody, maxDepth));

  context[PAYLOAD_DEPTH_CHECK] = {
    body: context.body,
    rawBody: context.rawBody,
    maxDepth,
    tooDeep,
  };

  if (tooDeep && !context.blockedDueToPayloadDepth) {
    updateContext(context, "blockedDueToPayloadDepth", true);
    agent.getInspectionStatistics().onAbortedRequest();
  }

  return tooDeep;
}
