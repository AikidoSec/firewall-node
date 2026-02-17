import type { Context } from "hono";
import { getRawNodeRequest } from "./getRawRequest";

/**
 * Tries to get the remote address (ip) from the context of a Hono request.
 */
export function getRemoteAddress(c: Context): string | undefined {
  const rawReq = getRawNodeRequest(c);

  return rawReq?.socket?.remoteAddress;
}
