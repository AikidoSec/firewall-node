import type { Context as HonoContext } from "hono";
import type { IncomingMessage } from "http";

export function getRawNodeRequest(c: HonoContext): IncomingMessage | undefined {
  // Node.js server
  // https://github.com/honojs/node-server/blob/fc749268c411bfdd7babd781cee5bdfed244f1c0/src/conninfo.ts#L10
  if (!c.env) {
    return;
  }

  const bindings = c.env.server ? c.env.server : c.env;

  return bindings?.incoming;
}
