import { hostname, platform, release } from "node:os";
import { API, AgentInfo, Token, Stats, Kind } from "./API";
import { Logger } from "./Logger";
import { Context } from "./Context";
import { resolve } from "path";
import { Source } from "./Source";
import { address } from "ip";

export class Agent {
  private heartbeatIntervalInMS = 60 * 60 * 1000;
  private interval: NodeJS.Timeout | undefined = undefined;
  private stats: Stats = {};
  private preventedPrototypePollution = false;

  constructor(
    private readonly block: boolean,
    private readonly logger: Logger,
    private readonly api: API,
    private readonly token: Token | undefined,
    private readonly serverless: boolean,
    private readonly wrappedPackages: Record<
      string,
      { version: string | null; supported: boolean }
    >
  ) {}

  shouldBlock() {
    return this.block;
  }

  onInspectedCall({
    detectedAttack,
    module,
    withoutContext,
  }: {
    detectedAttack: boolean;
    module: string;
    withoutContext: boolean;
  }) {
    this.stats[module] = this.stats[module] || {
      blocked: 0,
      allowed: 0,
      withoutContext: 0,
      total: 0,
    };

    this.stats[module].total += 1;

    if (withoutContext) {
      this.stats[module].withoutContext += 1;
      this.stats[module].allowed += 1;
      return;
    }

    if (detectedAttack) {
      if (this.block) {
        this.stats[module].blocked += 1;
      } else {
        this.stats[module].allowed += 1;
      }
    } else {
      this.stats[module].allowed += 1;
    }
  }

  onPrototypePollutionPrevented() {
    this.logger.log("Prevented prototype pollution!");

    // Will be sent in the next heartbeat
    this.preventedPrototypePollution = true;
  }

  onStart() {
    if (this.token) {
      this.api
        .report(this.token, {
          type: "started",
          time: Date.now(),
          agent: this.getAgentInfo(),
        })
        .catch(() => {
          this.logger.log("Failed to report started event");
        });
    }
  }

  onDetectedAttack({
    module,
    kind,
    blocked,
    source,
    request,
    stack,
    path,
    metadata,
  }: {
    module: string;
    kind: Kind;
    blocked: boolean;
    source: Source;
    request: Context;
    stack: string;
    path: string;
    metadata: Record<string, string>;
  }) {
    if (this.token) {
      this.api
        .report(this.token, {
          type: "detected_attack",
          time: Date.now(),
          attack: {
            module: module,
            blocked: blocked,
            path: path,
            stack: stack,
            source: source,
            metadata: metadata,
            kind: kind,
          },
          request: {
            method: request.method,
            url: request.url,
            ipAddress: request.remoteAddress,
            userAgent:
              typeof request.headers["user-agent"] === "string"
                ? request.headers["user-agent"]
                : undefined,
          },
          agent: this.getAgentInfo(),
        })
        .catch(() => {
          this.logger.log("Failed to report attack");
        });
    }
  }

  heartbeat() {
    if (this.token) {
      this.logger.log("Heartbeat...");
      this.api
        .report(this.token, {
          type: "heartbeat",
          time: Date.now(),
          agent: this.getAgentInfo(),
          stats: this.stats,
        })
        .catch(() => {
          this.logger.log("Failed to do heartbeat");
        });
    }
  }

  private startHeartbeats() {
    if (this.serverless) {
      throw new Error("Heartbeats in serverless mode are not supported");
    }

    if (this.interval) {
      throw new Error("Interval already started");
    }

    this.interval = setInterval(
      this.heartbeat.bind(this),
      this.heartbeatIntervalInMS
    );

    this.interval.unref();
  }

  private getAgentVersion(): string {
    const json = require(resolve(__dirname, "../../package.json"));

    if (!json.version) {
      throw new Error("Missing version in package.json");
    }

    return json.version;
  }

  private getAgentInfo(): AgentInfo {
    return {
      dryMode: !this.block,
      hostname: hostname() || "",
      version: this.getAgentVersion(),
      ipAddress: address() || "",
      packages: Object.keys(this.wrappedPackages).reduce(
        (packages: Record<string, string>, pkg) => {
          const details = this.wrappedPackages[pkg];
          if (details.version && details.supported) {
            packages[pkg] = details.version;
          }

          return packages;
        },
        {}
      ),
      preventedPrototypePollution: this.preventedPrototypePollution,
      nodeEnv: process.env.NODE_ENV || "",
      serverless: this.serverless,
      os: {
        name: platform(),
        version: release(),
      },
    };
  }

  start() {
    this.logger.log("Starting agent...");

    if (!this.block) {
      this.logger.log("Dry mode enabled, no requests will be blocked!");
    }

    if (this.token) {
      this.logger.log("Found token, reporting enabled!");
    } else {
      this.logger.log("No token provided, disabling reporting.");
    }

    for (const pkg in this.wrappedPackages) {
      const details = this.wrappedPackages[pkg];

      if (!details.version) {
        continue;
      }

      if (details.supported) {
        this.logger.log(`${pkg}@${details.version} is supported!`);
      } else {
        this.logger.log(`${pkg}@${details.version} is not supported!`);
      }
    }

    this.onStart();

    if (!this.serverless) {
      this.startHeartbeats();
    }
  }
}
