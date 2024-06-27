/* eslint-disable max-lines-per-function */
import { hostname, platform, release } from "os";
import { convertRequestBodyToString } from "../helpers/convertRequestBodyToString";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { ip } from "../helpers/ipAddress";
import { filterEmptyRequestHeaders } from "../helpers/filterEmptyRequestHeaders";
import { limitLengthMetadata } from "../helpers/limitLengthMetadata";
import { RateLimiter } from "../ratelimiting/RateLimiter";
import { ReportingAPI, ReportingAPIResponse } from "./api/ReportingAPI";
import { AgentInfo } from "./api/Event";
import { Token } from "./api/Token";
import { Kind } from "./Attack";
import { pollForChanges } from "./realtime/pollForChanges";
import { Context } from "./Context";
import { Hostnames } from "./Hostnames";
import { InspectionStatistics } from "./InspectionStatistics";
import { Logger } from "./logger/Logger";
import { Routes } from "./Routes";
import { ServiceConfig } from "./ServiceConfig";
import { Source } from "./Source";
import { Users } from "./Users";
import { wrapInstalledPackages } from "./wrapInstalledPackages";
import { Wrapper } from "./Wrapper";
import { wrapRequire } from "./wrapRequire";

type WrappedPackage = { version: string | null; supported: boolean };

export class Agent {
  private started = false;
  private sendHeartbeatEveryMS = 30 * 60 * 1000;
  private checkIfHeartbeatIsNeededEveryMS = 60 * 1000;
  private lastHeartbeat = Date.now();
  private reportedInitialStats = false;
  private interval: NodeJS.Timeout | undefined = undefined;
  private preventedPrototypePollution = false;
  private incompatiblePackages: Record<string, string> = {};
  private wrappedPackages: Record<string, WrappedPackage> = {};
  private timeoutInMS = 5000;
  private hostnames = new Hostnames(200);
  private users = new Users(1000);
  private serviceConfig = new ServiceConfig([], Date.now(), [], []);
  private routes: Routes = new Routes(200);
  private rateLimiter: RateLimiter = new RateLimiter(5000, 120 * 60 * 1000);
  private statistics = new InspectionStatistics({
    maxPerfSamplesInMemory: 5000,
    maxCompressedStatsInMemory: 100,
  });

  constructor(
    private readonly block: boolean,
    private readonly logger: Logger,
    private readonly api: ReportingAPI,
    private readonly token: Token | undefined,
    private readonly serverless: string | undefined
  ) {
    if (typeof this.serverless === "string" && this.serverless.length === 0) {
      throw new Error("Serverless cannot be an empty string");
    }
  }

  shouldBlock() {
    return this.block;
  }

  getHostnames() {
    return this.hostnames;
  }

  getInspectionStatistics() {
    return this.statistics;
  }

  unableToPreventPrototypePollution(
    incompatiblePackages: Record<string, string>
  ) {
    this.incompatiblePackages = incompatiblePackages;

    const list: string[] = [];
    for (const pkg in incompatiblePackages) {
      list.push(`${pkg}@${incompatiblePackages[pkg]}`);
    }

    this.logger.log(
      `Unable to prevent prototype pollution, incompatible packages found: ${list.join(" ")}`
    );
  }

  onPrototypePollutionPrevented() {
    this.logger.log("Prevented prototype pollution!");

    // Will be sent in the next heartbeat
    this.preventedPrototypePollution = true;
    this.incompatiblePackages = {};
  }

  /**
   * Reports to the API that this agent has started
   */
  async onStart() {
    if (this.token) {
      const result = await this.api.report(
        this.token,
        {
          type: "started",
          time: Date.now(),
          agent: this.getAgentInfo(),
        },
        this.timeoutInMS
      );

      this.updateServiceConfig(result);
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
    operation,
    kind,
    blocked,
    source,
    request,
    stack,
    path,
    metadata,
    payload,
  }: {
    module: string;
    operation: string;
    kind: Kind;
    blocked: boolean;
    source: Source;
    request: Context;
    stack: string;
    path: string;
    metadata: Record<string, string>;
    payload: unknown;
  }) {
    if (this.token) {
      this.api
        .report(
          this.token,
          {
            type: "detected_attack",
            time: Date.now(),
            attack: {
              module: module,
              operation: operation,
              blocked: blocked,
              path: path,
              stack: stack,
              source: source,
              metadata: limitLengthMetadata(metadata, 4096),
              kind: kind,
              payload: JSON.stringify(payload).substring(0, 4096),
              user: request.user,
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
              source: request.source,
              route: request.route,
            },
            agent: this.getAgentInfo(),
          },
          this.timeoutInMS
        )
        .catch(() => {
          this.logger.log("Failed to report attack");
        });
    }
  }

  /**
   * Sends a heartbeat via the API to the server (only when not in serverless mode)
   */
  private heartbeat(timeoutInMS = this.timeoutInMS) {
    this.sendHeartbeat(timeoutInMS).catch(() => {
      this.logger.log("Failed to do heartbeat");
    });
  }

  getUsers() {
    return this.users;
  }

  getConfig() {
    return this.serviceConfig;
  }

  private updateServiceConfig(response: ReportingAPIResponse) {
    if (response.success) {
      if (response.endpoints) {
        this.serviceConfig = new ServiceConfig(
          response.endpoints && Array.isArray(response.endpoints)
            ? response.endpoints
            : [],
          typeof response.configUpdatedAt === "number"
            ? response.configUpdatedAt
            : Date.now(),
          response.blockedUserIds && Array.isArray(response.blockedUserIds)
            ? response.blockedUserIds
            : [],
          response.allowedIPAddresses &&
          Array.isArray(response.allowedIPAddresses)
            ? response.allowedIPAddresses
            : []
        );
      }

      const minimumHeartbeatIntervalMS = 2 * 60 * 1000;

      if (
        typeof response.heartbeatIntervalInMS === "number" &&
        response.heartbeatIntervalInMS >= minimumHeartbeatIntervalMS
      ) {
        this.sendHeartbeatEveryMS = response.heartbeatIntervalInMS;
      }
    }
  }

  private async sendHeartbeat(timeoutInMS: number) {
    if (this.token) {
      this.logger.log("Heartbeat...");
      const stats = this.statistics.getStats();
      const routes = this.routes.asArray();
      const outgoingDomains = this.hostnames.asArray();
      const users = this.users.asArray();
      const endedAt = Date.now();
      this.statistics.reset();
      this.routes.clear();
      this.hostnames.clear();
      this.users.clear();
      const response = await this.api.report(
        this.token,
        {
          type: "heartbeat",
          time: Date.now(),
          agent: this.getAgentInfo(),
          stats: {
            sinks: stats.sinks,
            startedAt: stats.startedAt,
            endedAt: endedAt,
            requests: stats.requests,
          },
          hostnames: outgoingDomains,
          routes: routes,
          users: users,
        },
        timeoutInMS
      );
      this.updateServiceConfig(response);
    }
  }

  /**
   * Starts a heartbeat when not in serverless mode : Make contact with api every x seconds.
   */
  private startHeartbeats() {
    if (this.serverless) {
      this.logger.log(
        "Running in serverless environment, not starting heartbeats"
      );
      return;
    }

    if (!this.token) {
      this.logger.log("No token provided, not starting heartbeats");
      return;
    }

    /* c8 ignore next 3 */
    if (this.interval) {
      throw new Error("Interval already started");
    }

    this.interval = setInterval(() => {
      const now = Date.now();
      const diff = now - this.lastHeartbeat;
      const shouldSendHeartbeat = diff > this.sendHeartbeatEveryMS;
      const shouldReportInitialStats =
        this.statistics.hasCompressedStats() && !this.reportedInitialStats;

      if (shouldSendHeartbeat || shouldReportInitialStats) {
        this.heartbeat();
        this.lastHeartbeat = now;
        this.reportedInitialStats = true;
      }
    }, this.checkIfHeartbeatIsNeededEveryMS);

    this.interval.unref();
  }

  private startPollingForConfigChanges() {
    pollForChanges({
      token: this.token,
      serverless: this.serverless,
      logger: this.logger,
      lastUpdatedAt: this.serviceConfig.getLastUpdatedAt(),
      onConfigUpdate: (config) => {
        this.updateServiceConfig({ success: true, ...config });
      },
    });
  }

  private getAgentInfo(): AgentInfo {
    return {
      dryMode: !this.block,
      /* c8 ignore next */
      hostname: hostname() || "",
      version: getAgentVersion(),
      library: "firewall-node",
      /* c8 ignore next */
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
      incompatiblePackages: {
        prototypePollution: this.incompatiblePackages,
      },
      preventedPrototypePollution: this.preventedPrototypePollution,
      nodeEnv: process.env.NODE_ENV || "",
      serverless: !!this.serverless,
      stack: Object.keys(this.wrappedPackages).concat(
        this.serverless ? [this.serverless] : []
      ),
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

    // Wrap require function
    wrapRequire(this);

    for (const pkg in this.wrappedPackages) {
      const details = this.wrappedPackages[pkg];

      /* c8 ignore next 3 */
      if (!details.version) {
        continue;
      }

      if (details.supported) {
        this.logger.log(`${pkg}@${details.version} is supported!`);
      } else {
        this.logger.log(`${pkg}@${details.version} is not supported!`);
      }
    }

    // Send startup event and wait for config
    // Then start heartbeats and polling for config changes
    this.onStart()
      .then(() => {
        this.startHeartbeats();
        this.startPollingForConfigChanges();
      })
      .catch(() => {
        this.logger.log("Failed to start agent");
      });
  }

  onFailedToWrapMethod(module: string, name: string) {
    this.logger.log(`Failed to wrap method ${name} in module ${module}`);
  }

  onConnectHostname(hostname: string, port: number | undefined) {
    this.hostnames.add(hostname, port);
  }

  onRouteExecute(method: string, path: string) {
    this.routes.addRoute(method, path);
  }

  getRoutes() {
    return this.routes;
  }

  async flushStats(timeoutInMS: number) {
    this.statistics.forceCompress();
    await this.sendHeartbeat(timeoutInMS);
  }

  getRateLimiter() {
    return this.rateLimiter;
  }
}
