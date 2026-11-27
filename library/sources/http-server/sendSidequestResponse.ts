import { ServerResponse } from "http";
import type { Agent } from "../../agent/Agent";
import type { Context } from "../../agent/Context";
import { createSafeObject } from "../../helpers/createSafeObject";
import {
  servedSidequest,
  type InstrumentedRequest,
} from "./InstrumentedRequest";

export function sendSidequestResponse(
  req: InstrumentedRequest,
  res: ServerResponse,
  agent: Agent,
  context: Context
): boolean {
  const method = req.method;
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  const config = agent.getConfig();
  const rule = config.findSidequestRule(req.url);
  if (
    !rule ||
    config.isBypassedRequest(context) ||
    !(res instanceof ServerResponse) ||
    res.headersSent ||
    res.destroyed
  ) {
    return false;
  }

  const headers: Record<string, string | number> = createSafeObject(
    {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
    rule.headers,
    {
      "content-length": Buffer.byteLength(rule.body),
      "x-content-type-options": "nosniff",
    }
  );
  delete headers["transfer-encoding"];
  delete headers.trailer;

  req[servedSidequest] = true;
  res.writeHead(200, headers);
  res.end(method === "HEAD" ? undefined : rule.body);
  return true;
}
