import type { IncomingMessage } from "http";

export function hasBody(req: IncomingMessage) {
  const encoding = "transfer-encoding" in req.headers;
  const len =
    "content-length" in req.headers && req.headers["content-length"] !== "0";

  return encoding || len;
}
