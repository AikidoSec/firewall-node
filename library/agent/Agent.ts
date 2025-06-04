/* eslint-disable max-lines-per-function, no-console */
import { hostname, platform, release } from "os";
import { convertRequestBodyToString } from "../helpers/convertRequestBodyToString";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { ip } from "../helpers/ipAddress";
import { filterEmptyRequestHeaders } from "../helpers/filterEmptyRequestHeaders";
import { limitLengthMetadata } from "../helpers/limitLengthMetadata";
import { RateLimiter } from "../ratelimiting/RateLimiter";
import { fetchBlockedLists } from "./api/fetchBlockedLists";
import { ReportingAPI, ReportingAPIResponse } from "./api/ReportingAPI";
import { AgentInfo, DetectedAttack } from "./api/Event";
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
import { isAikidoCI } from "../helpers/isAikidoCI";
import { AttackLogger } from "./AttackLogger";
import { Packages } from "./Packages";

type WrappedPackage = { version: string | null; supported: boolean };

export class Agent {
  private started = false;
  private sendHeartbeatEveryMS = 10 * 60 * 1000;
  private checkIfHeartbeatIsNeededEveryMS = 60 * 1000;
  private lastHeartbeat = performance.now();
  private reportedInitialStats = false;
  private interval: NodeJS.Timeout | undefined = undefined;
  private preventedPrototypePollution = false;
  private incompatiblePackages: Record<string, string> = {};
  private wrappedPackages: Record<string, WrappedPackage> = {};
  private packages = new Packages();
  private timeoutInMS = 30 * 1000;
  private hostnames = new Hostnames(200);
  private users = new Users(1000);
  private serviceConfig = new ServiceConfig(
    [],
    Date.now(),
    [],
    [],
    true,
    [],
    []
  );
  private routes: Routes = new Routes(200);
  private rateLimiter: RateLimiter = new RateLimiter(5000, 120 * 60 * 1000);
  private statistics = new InspectionStatistics({
    maxPerfSamplesInMemory: 5000,
    maxCompressedStatsInMemory: 20, // per operation
  });
  private middlewareInstalled = false;
  private attackLogger = new AttackLogger(1000);

  constructor(
    private block: boolean,
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
        // We don't use `this.timeoutInMS` for startup event
        // Since Node.js is single threaded, the HTTP request is fired before other imports are required
        // It might take a long time before our code resumes
        60 * 1000
      );

      this.checkForReportingAPIError(result);
      this.updateServiceConfig(result);

      await this.updateBlockedLists();
    }
  }

  checkForReportingAPIError(result: ReportingAPIResponse) {
    if (!result.success) {
      if (result.error === "invalid_token") {
        console.error(
          "Aikido: We were unable to connect to the Aikido platform. Please verify that your token is correct."
        );
      } else {
        console.error(
          `Aikido: Failed to connect to the Aikido platform: ${result.error}`
        );
      }
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
    paths,
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
    paths: string[];
    metadata: Record<string, string>;
    payload: unknown;
  }) {
    const attack: DetectedAttack = {
      type: "detected_attack",
      time: Date.now(),
      attack: {
        module: module,
        operation: operation,
        blocked: blocked,
        path: paths.length > 0 ? paths[0] : "",
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
    };

    this.getInspectionStatistics().onDetectedAttack({
      blocked,
    });

    this.attackLogger.log(attack);

    if (this.token) {
      this.api.report(this.token, attack, this.timeoutInMS).catch(() => {
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
      if (typeof response.block === "boolean") {
        if (response.block !== this.block) {
          this.block = response.block;
          this.logger.log(
            `Block mode has been set to ${this.block ? "on" : "off"}`
          );
        }
      }

      if (response.endpoints) {
        this.serviceConfig.updateConfig(
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
            : [],
          typeof response.receivedAnyStats === "boolean"
            ? response.receivedAnyStats
            : true
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
      const packages = this.packages.asArray();
      const endedAt = Date.now();
      this.statistics.reset();
      this.routes.clear();
      this.hostnames.clear();
      this.users.clear();
      this.packages.clear();
      const response = await this.api.report(
        this.token,
        {
          type: "heartbeat",
          time: Date.now(),
          agent: this.getAgentInfo(),
          stats: {
            operations: stats.operations,
            startedAt: stats.startedAt,
            endedAt: endedAt,
            requests: stats.requests,
            userAgents: stats.userAgents,
            ipAddresses: stats.ipAddresses,
            sqlTokenizationFailures: stats.sqlTokenizationFailures,
          },
          packages,
          hostnames: outgoingDomains,
          routes: routes,
          users: users,
          middlewareInstalled: this.middlewareInstalled,
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
      const now = performance.now();
      const diff = now - this.lastHeartbeat;
      const shouldSendHeartbeat = diff > this.sendHeartbeatEveryMS;
      const canSendInitialStats =
        !this.serviceConfig.hasReceivedAnyStats() && !this.statistics.isEmpty();
      const shouldReportInitialStats =
        !this.reportedInitialStats && canSendInitialStats;

      if (shouldSendHeartbeat || shouldReportInitialStats) {
        this.heartbeat();
        this.lastHeartbeat = now;
        this.reportedInitialStats = true;
      }
    }, this.checkIfHeartbeatIsNeededEveryMS);

    this.interval.unref();
  }

  private async updateBlockedLists() {
    if (!this.token) {
      return;
    }

    if (this.serverless) {
      // Not supported in serverless mode
      return;
    }

    try {
      const {
        blockedIPAddresses,
        blockedUserAgents,
        allowedIPAddresses,
        monitoredIPAddresses,
        monitoredUserAgents,
        userAgentDetails,
      } = await fetchBlockedLists(this.token);
      this.serviceConfig.updateBlockedIPAddresses(blockedIPAddresses);
      this.serviceConfig.updateBlockedUserAgents(blockedUserAgents);
      this.serviceConfig.updateAllowedIPAddresses(allowedIPAddresses);
      this.serviceConfig.updateMonitoredIPAddresses(monitoredIPAddresses);
      this.serviceConfig.updateMonitoredUserAgents(monitoredUserAgents);
      this.serviceConfig.updateUserAgentDetails(userAgentDetails);
    } catch (error: any) {
      console.error(`Aikido: Failed to update blocked lists: ${error.message}`);
    }
  }

  private startPollingForConfigChanges() {
    pollForChanges({
      token: this.token,
      serverless: this.serverless,
      logger: this.logger,
      lastUpdatedAt: this.serviceConfig.getLastUpdatedAt(),
      onConfigUpdate: (config) => {
        this.updateServiceConfig({ success: true, ...config });
        this.updateBlockedLists().catch((error) => {
          this.logger.log(`Failed to update blocked lists: ${error.message}`);
        });
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
      platform: {
        version: getSemverNodeVersion(),
        arch: process.arch,
      },
    };
  }

  start(wrappers: Wrapper[]) {
    if (this.started) {
      throw new Error("Agent already started!");
    }

    this.started = true;

    this.logger.log(`Starting agent v${getAgentVersion()}...`);

    if (!this.block) {
      this.logger.log("Dry mode enabled, no requests will be blocked!");
    }

    if (this.token) {
      this.logger.log("Found token, reporting enabled!");
    } else {
      this.logger.log("No token provided, disabling reporting.");

      if (!this.block && !isAikidoCI()) {
        console.log(
          "AIKIDO: Running in monitoring only mode without reporting to Aikido Cloud. Set AIKIDO_BLOCK=true to enable blocking."
        );
      }
    }

    // When our library is required, we are not intercepting `require` calls yet
    // We need to add our library to the list of packages manually
    this.onPackageRequired("@aikidosec/firewall", getAgentVersion());

    wrapInstalledPackages(wrappers, this.serverless);

    // Send startup event and wait for config
    // Then start heartbeats and polling for config changes
    this.onStart()
      .then(() => {
        this.startHeartbeats();
        this.startPollingForConfigChanges();
      })
      .catch((err) => {
        console.error(`Aikido: Failed to start agent: ${err.message}`);
      });
  }

  onFailedToWrapMethod(module: string, name: string, error: Error) {
    this.logger.log(
      `Failed to wrap method ${name} in module ${module}: ${error.message}`
    );
  }

  onFailedToWrapModule(module: string, error: Error) {
    this.logger.log(`Failed to wrap module ${module}: ${error.message}`);
  }

  onPackageRequired(name: string, version: string) {
    this.packages.addPackage({
      name,
      version,
    });
  }

  onPackageWrapped(name: string, details: WrappedPackage) {
    if (this.wrappedPackages[name]) {
      // Already reported as wrapped
      return;
    }

    this.wrappedPackages[name] = details;

    if (details.version) {
      if (details.supported) {
        this.logger.log(`${name}@${details.version} is supported!`);
      } else {
        this.logger.log(`${name}@${details.version} is not supported!`);
      }
    }
  }

  onConnectHostname(hostname: string, port: number) {
    this.hostnames.add(hostname, port);
  }

  onRouteExecute(context: Context) {
    this.routes.addRoute(context);
  }

  hasGraphQLSchema(method: string, path: string) {
    return this.routes.hasGraphQLSchema(method, path);
  }

  onGraphQLSchema(method: string, path: string, schema: string) {
    this.routes.setGraphQLSchema(method, path, schema);
  }

  onGraphQLExecute(
    method: string,
    path: string,
    type: "query" | "mutation",
    topLevelFields: string[]
  ) {
    topLevelFields.forEach((field) => {
      this.routes.addGraphQLField(method, path, type, field);
    });
  }

  getRoutes() {
    return this.routes;
  }

  log(message: string) {
    this.logger.log(message);
  }

  async flushStats(timeoutInMS: number) {
    this.statistics.forceCompress();
    await this.sendHeartbeat(timeoutInMS);
  }

  getRateLimiter() {
    return this.rateLimiter;
  }

  onMiddlewareExecuted() {
    this.middlewareInstalled = true;
  }
}
