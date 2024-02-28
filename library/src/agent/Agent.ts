/* eslint-disable max-lines-per-function */
import { hostname, platform, release } from "node:os";
import { convertRequestBodyToString } from "../helpers/convertRequestBodyToString";
import { ip } from "../helpers/ipAddress";
import { isPlainObject } from "../helpers/isPlainObject";
import { normalizeRequestHeaders } from "../helpers/normalizeRequestHeaders";
import { API } from "./api/API";
import { AgentInfo, Kind, Stats } from "./api/Event";
import { Token } from "./api/Token";
import { Context } from "./Context";
import { resolve } from "path";
import { Logger } from "./logger/Logger";
import { Source } from "./Source";

export class Agent {
  /** Gives the interval in milliseconds between heartbeats. Currently set at 1h */
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

  /**
   * Reports to the API that this agent has started
   */
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

  /**
   * This function gets called when an attack is detected, it reports this attack to the API
   */
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
            body: convertRequestBodyToString(request.body),
            headers: normalizeRequestHeaders(request.headers),
          },
          agent: this.getAgentInfo(),
        })
        .catch(() => {
          this.logger.log("Failed to report attack");
        });
    }
  }

  /**
   * Sends a heartbeat via the API to the server (only when not in serverless mode)
   */
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

  /**
   * Starts a heartbeat when not in serverless mode : Make contact with api every x seconds.
   */
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

  /**
   * Gets this project's version number from the package.json file
   * @returns version number
   */
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
      ipAddress: ip() || "",
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

  /**
   * Starts up the agent
   * Checks parameters like block and token,
   * starts heartbeats if necessary and checks which packages are supported,
   * afterward it calls {@link onStart}
   */
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
