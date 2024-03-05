/* eslint-disable max-lines-per-function */
import { hostname, platform, release } from "node:os";
import { convertRequestBodyToString } from "../helpers/convertRequestBodyToString";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { ip } from "../helpers/ipAddress";
import { filterEmptyRequestHeaders } from "../helpers/filterEmptyRequestHeaders";
import { API } from "./api/API";
import { AgentInfo } from "./api/Event";
import { Token } from "./api/Token";
import { Kind } from "./Attack";
import { Context } from "./Context";
import { InspectionStatistics } from "./InspectionStatistics";
import { Logger } from "./logger/Logger";
import { Source } from "./Source";
import { wrapInstalledPackages } from "./wrapInstalledPackages";
import { Wrapper } from "./Wrapper";

type WrappedPackage = { version: string | null; supported: boolean };

export class Agent {
  private started = false;
  private sendHeartbeatEveryMS = 30 * 60 * 1000;
  private checkIfHeartbeatIsNeededEveryMS = 5 * 1000;
  private lastHeartbeat = Date.now();
  private reportedInitialStats = false;
  private interval: NodeJS.Timeout | undefined = undefined;
  private preventedPrototypePollution = false;
  private wrappedPackages: Record<string, WrappedPackage> = {};
  private statistics = new InspectionStatistics({
    maxTimings: 5000,
  });

  constructor(
    private readonly block: boolean,
    private readonly logger: Logger,
    private readonly api: API,
    private readonly token: Token | undefined,
    private readonly serverless: boolean
  ) {}

  shouldBlock() {
    return this.block;
  }

  getInspectionStatistics() {
    return this.statistics;
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

  onErrorThrownByInterceptor({
    error,
    module,
    method,
  }: {
    error: Error;
    module: string;
    method: string;
  }) {
    this.logger.log(
      `Internal error in module "${module}" in method "${method}"\n${error.stack}`
    );
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
            headers: filterEmptyRequestHeaders(request.headers),
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
  private heartbeat() {
    if (this.token) {
      this.logger.log("Heartbeat...");
      this.api
        .report(this.token, {
          type: "heartbeat",
          time: Date.now(),
          agent: this.getAgentInfo(),
          stats: this.statistics.getStats(),
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

    this.interval = setInterval(() => {
      const now = Date.now();
      const diff = now - this.lastHeartbeat;
      const shouldSendHeartbeat =
        diff > this.sendHeartbeatEveryMS ||
        (this.statistics.reachedMaxTimings() && !this.reportedInitialStats);

      if (shouldSendHeartbeat) {
        this.heartbeat();
        this.lastHeartbeat = now;
        this.reportedInitialStats = true;
      }
    }, this.checkIfHeartbeatIsNeededEveryMS);

    this.interval.unref();
  }

  private getAgentInfo(): AgentInfo {
    return {
      dryMode: !this.block,
      hostname: hostname() || "",
      version: getAgentVersion(),
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

  start(wrappers: Wrapper[]) {
    if (this.started) {
      throw new Error("Agent already started!");
    }

    this.started = true;

    this.logger.log("Starting agent...");

    if (!this.block) {
      this.logger.log("Dry mode enabled, no requests will be blocked!");
    }

    if (this.token) {
      this.logger.log("Found token, reporting enabled!");
    } else {
      this.logger.log("No token provided, disabling reporting.");
    }

    this.wrappedPackages = wrapInstalledPackages(this, wrappers);

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
