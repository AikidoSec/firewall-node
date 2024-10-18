import type { RequestHandler } from "express";
import { shouldBlockRequest } from ".";

export function express(): RequestHandler {
  return (req, res, next) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "rate-limit") {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${result.ip})`;
        }

        return res.status(429).send(message);
      }

      if (result.type === "blocked") {
        return res.status(403).send("You are blocked by Aikido firewall.");
      }
    }

    next();
  };
}
