import type { IncomingMessage } from "http";

export const countedRequest = Symbol("__zen_request_counted__");
export const servedSidequest = Symbol("__zen_sidequest_served__");

export type InstrumentedRequest = IncomingMessage & {
  [countedRequest]?: boolean;
  [servedSidequest]?: boolean;
};
