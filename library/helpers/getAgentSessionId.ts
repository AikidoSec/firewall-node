import { uuidv7 } from "./uuidv7";

const sessionId = uuidv7();

export function getAgentSessionId(): string {
  return sessionId;
}
