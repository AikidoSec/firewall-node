import { escapeLog } from "../helpers/escapeLog";
import { DetectedAttack } from "./api/Event";
import { attackKindHumanName } from "./Attack";

export class AttackLogger {
  // Tracks number of logs in the current hour
  private logCount: number = 0;

  // Tracks the last reset time
  private lastResetTime: number = Date.now();

  constructor(private readonly maxLogs: number) {
    if (this.maxLogs <= 0) {
      throw new Error("maxLogs must be greater than 0");
    }
  }

  log(event: DetectedAttack): void {
    const currentTime = Date.now();
    // Reset the counter if more than an hour has passed
    this.resetLogCountIfNeeded(currentTime);

    if (this.logCount >= this.maxLogs) {
      return;
    }

    this.logCount++; // Increment the log counter

    const { blocked, kind, operation, source, path } = event.attack;
    const ipAddress = event.request?.ipAddress;

    const message = `Zen has ${blocked ? "blocked" : "detected"} ${attackKindHumanName(kind)}: kind="${escapeLog(kind)}" operation="${escapeLog(operation)}(...)" source="${escapeLog(source)}${escapeLog(path)}" ip="${escapeLog(ipAddress)}"`;

    // oxlint-disable-next-line no-console
    console.log(message);
  }

  private resetLogCountIfNeeded(currentTime: number): void {
    // Reset the count if the last reset was more than an hour ago
    const oneHourAgo = this.lastResetTime + 60 * 60 * 1000;

    if (currentTime >= oneHourAgo) {
      this.logCount = 0;
      this.lastResetTime = currentTime;
    }
  }
}
