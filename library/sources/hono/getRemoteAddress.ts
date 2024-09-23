import type { Context } from "hono";

/**
 * Tries to get the remote address (ip) from the context of a Hono request.
 */
export function getRemoteAddress(c: Context): string | undefined {
  // Node.js server
  // https://github.com/honojs/node-server/blob/fc749268c411bfdd7babd781cee5bdfed244f1c0/src/conninfo.ts#L10
  if (c.env) {
    try {
      const bindings = c.env.server ? c.env.server : c.env;
      const addressInfo = bindings.incoming.socket.address();

      if ("address" in addressInfo && typeof addressInfo.address === "string") {
        return addressInfo.address;
      }
    } catch (e) {
      // Ignore
    }
  }

  return undefined;
}
