import type { RequestHandler } from "express";
import { shouldBlockRequest } from ".";
import { escapeHTML } from "../helpers/escapeHTML";

export function express(): RequestHandler {
  return (req, res, next) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "rate-limit") {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        return res.status(429).type("text").send(message);
      }

      if (result.type === "blocked") {
        return res
          .status(403)
          .type("text")
          .send("You are blocked by Aikido firewall.");
      }
    }

    next();
  };
}
