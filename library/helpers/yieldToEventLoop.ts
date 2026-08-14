import { setImmediate } from "node:timers/promises";

export async function yieldToEventLoop(): Promise<void> {
  await setImmediate();
}
