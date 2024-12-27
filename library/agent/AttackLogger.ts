/* eslint-disable no-console */
import { escapeLog } from "../helpers/escapeLog";
import { DetectedAttack } from "./api/Event";
import { attackKindHumanName } from "./Attack";

export class AttackLogger {
  // Number of attacks we've logged
  private loggedAttacks: number = 0;

  // Whether we've logged that we're no longer logging attacks
  private loggedEnd: boolean = false;

  constructor(private readonly maxLogs: number) {}

  private notifyStopLogging(): void {
    if (!this.loggedEnd) {
      console.log(
        `Zen has detected more than ${this.maxLogs} attacks. No longer logging them.`
      );
      this.loggedEnd = true;
    }
  }

  log(event: DetectedAttack): void {
    if (this.loggedAttacks >= this.maxLogs) {
      return this.notifyStopLogging();
    }

    this.loggedAttacks++;

    const { blocked, kind, operation, source, path } = event.attack;
    const { ipAddress } = event.request;
    const message = `Zen has ${blocked ? "blocked" : "detected"} ${attackKindHumanName(kind)}: kind="${kind}" operation="${operation}(...)" source="${source}${escapeLog(path)}" ip="${escapeLog(ipAddress)}"`;

    console.log(message);
  }
}
