import { setTimeout } from "timers/promises";

export function timeout(ms) {
  return setTimeout(ms);
}
