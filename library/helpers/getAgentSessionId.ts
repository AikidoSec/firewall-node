import { randomUUID } from "crypto";

const sessionId = randomUUID();

export function getAgentSessionId(): string {
  return sessionId;
}
