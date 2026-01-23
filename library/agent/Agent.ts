/* eslint-disable max-lines-per-function, no-console */
import { hostname, platform, release } from "os";
import { getAgentVersion } from "../helpers/getAgentVersion";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { ip } from "../helpers/ipAddress";
import { limitLengthMetadata } from "../helpers/limitLengthMetadata";
import { RateLimiter } from "../ratelimiting/RateLimiter";
import { ReportingAPI, ReportingAPIResponse } from "./api/ReportingAPI";
import type {
  AgentInfo,
  DetectedAttack,
  DetectedAttackWave,
} from "./api/Event";
import { Token } from "./api/Token";
import { Kind } from "./Attack";
import { Endpoint } from "./Config";
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
import { AIStatistics } from "./AIStatistics";
import { isNewInstrumentationUnitTest } from "../helpers/isNewInstrumentationUnitTest";
import { AttackWaveDetector } from "../vulnerabilities/attack-wave-detection/AttackWaveDetector";
import type { FetchListsAPI } from "./api/FetchListsAPI";
import { PendingEvents } from "./PendingEvents";

type WrappedPackage = { version: string | null; supported: boolean };

export class Agent {
  private started = false;
  private sendHeartbeatEveryMS = 10 * 60 * 1000;
  private checkIfHeartbeatIsNeededEveryMS = 30 * 1000;
  private lastHeartbeat = performance.now();
  private sentHeartbeatCounter = 0;
  private interval: NodeJS.Timeout | undefined = undefined;
  private preventedPrototypePollution = false;
  private incompatiblePackages: Record<string, string> = {};
  private wrappedPackages: Record<string, WrappedPackage> = {};
  private packages = new Packages(5000);
  private timeoutInMS = 30 * 1000;
  private hostnames = new Hostnames(200);
  private users = new Users(1000);
  private serviceConfig = new ServiceConfig([], Date.now(), [], [], [], []);
  private routes: Routes = new Routes(200);
  private rateLimiter: RateLimiter = new RateLimiter(5000, 120 * 60 * 1000);
  private statistics = new InspectionStatistics({
    maxPerfSamplesInMemory: 5000,
    maxCompressedStatsInMemory: 20, // per operation
  });
  private aiStatistics = new AIStatistics();
  private middlewareInstalled = false;
  private attackLogger = new AttackLogger(1000);
  private attackWaveDetector = new AttackWaveDetector();
  private pendingEvents = new PendingEvents();

  constructor(
    private block: boolean,
    private readonly logger: Logger,
    private readonly api: ReportingAPI,
    private readonly token: Token | undefined,
    private readonly serverless: string | undefined,
    // Use the new instrumentation system (CJS & ESM) using registerHook
    private readonly newInstrumentation: boolean = false,
    private readonly fetchListsAPI: FetchListsAPI
  ) {
    if (typeof this.serverless === "string" && this.serverless.length === 0) {
      throw new Error("Serverless cannot be an empty string");
    }

    if (isNewInstrumentationUnitTest()) {
      this.newInstrumentation = true;
    }
  }

  shouldBlock() {
    return this.block;
  }

  isServerless() {
    // e.g. "lambda" or "gcp"
    return typeof this.serverless === "string" && this.serverless.length > 0;
  }

  getHostnames() {
    return this.hostnames;
  }

  getInspectionStatistics() {
    return this.statistics;
  }

  getAIStatistics() {
    return this.aiStatistics;
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
  async onStart(timeoutInMS = 60 * 1000) {
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
        timeoutInMS
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
    source: Source | undefined;
    request: Context | undefined;
    stack: string;
    paths: string[];
    metadata: Record<string, string>;
    payload: unknown;
  }) {
    const attackRequest: DetectedAttack["request"] = request
      ? {
          method: request.method,
          url: request.url,
          ipAddress: request.remoteAddress,
          userAgent:
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"]
              : undefined,
          source: request.source,
          route: request.route,
        }
      : undefined;

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
        payload:
          payload !== undefined
            ? JSON.stringify(payload).substring(0, 4096)
            : undefined,
        user: request?.user,
      },
      request: attackRequest,
      agent: this.getAgentInfo(),
    };

    this.getInspectionStatistics().onDetectedAttack({
      blocked,
    });

    this.attackLogger.log(attack);

    if (this.token) {
      const promise = this.api
        .report(this.token, attack, this.timeoutInMS)
        .catch(() => {
          this.logger.log("Failed to report attack");
        });
      this.pendingEvents.onAPICall(promise);
    }
  }

  /**
   * Sends a heartbeat via the API to the server (only when not in serverless mode)
   */
  private heartbeat(timeoutInMS = this.timeoutInMS) {
    this.sendHeartbeat(timeoutInMS)
      .catch(() => {
        this.logger.log("Failed to do heartbeat");
      })
      .then(() => {
        this.sentHeartbeatCounter++;
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

      if (
        typeof response.blockNewOutgoingRequests === "boolean" &&
        response.domains &&
        Array.isArray(response.domains)
      ) {
        this.serviceConfig.setBlockNewOutgoingRequests(
          response.blockNewOutgoingRequests
        );
        this.serviceConfig.updateDomains(response.domains);
      }
    }
  }

  private async sendHeartbeat(timeoutInMS: number) {
    if (this.token) {
      this.logger.log("Heartbeat...");
      const stats = this.statistics.getStats();
      const aiStats = this.aiStatistics.getStats();
      const routes = this.routes.asArray();
      const outgoingDomains = this.hostnames.asArray();
      const users = this.users.asArray();
      const packages = this.packages.asArray();
      const endedAt = Date.now();
      this.statistics.reset();
      this.aiStatistics.reset();
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
          ai: aiStats,
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
    if (!this.token) {
      this.logger.log("No token provided, not starting heartbeats");
      return;
    }

    /* c8 ignore next 3 */
    if (this.interval) {
      throw new Error("Interval already started");
    }

    this.interval = setInterval(() => {
      const timeSinceLastHeartbeat = performance.now() - this.lastHeartbeat;

      if (timeSinceLastHeartbeat > this.getHeartbeatInterval()) {
        this.heartbeat();
        this.lastHeartbeat = performance.now();
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
      } = await this.fetchListsAPI.getLists(this.token);
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

    wrapInstalledPackages(
      wrappers,
      this.newInstrumentation,
      this.serverless,
      false // Is bundling process
    );

    // Send startup event and wait for config
    // Then start heartbeats and polling for config changes
    // In serverless environments, we delay the startup event until the first invocation
    // since some apps take a long time to boot and the init phase has strict timeouts
    if (this.serverless) {
      return;
    }

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

  onBuiltinWrapped(name: string) {
    this.logger.log(`node:${name} is supported!`);
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

  onRouteRateLimited(match: Endpoint) {
    // The count will be incremented for the rate-limited route, not for the exact route
    // So if it's a wildcard route, the count will be incremented for the wildcard route
    this.routes.countRouteRateLimited(match);
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

  getPendingEvents() {
    return this.pendingEvents;
  }

  getRateLimiter() {
    return this.rateLimiter;
  }

  onMiddlewareExecuted() {
    this.middlewareInstalled = true;
  }

  isUsingNewInstrumentation() {
    return this.newInstrumentation;
  }

  private getHeartbeatInterval(): number {
    switch (this.sentHeartbeatCounter) {
      case 0:
        // The first heartbeat should be sent after 30 seconds
        return 1000 * 30;
      case 1:
        // The second heartbeat should be sent after 2 minutes
        return 1000 * 60 * 2;
      default:
        // Subsequent heartbeats are sent every `sendHeartbeatEveryMS`
        return this.sendHeartbeatEveryMS;
    }
  }

  getAttackWaveDetector(): AttackWaveDetector {
    return this.attackWaveDetector;
  }

  /**
   * This function gets called when an attack wave is detected, it reports this attack wave to the API
   */
  onDetectedAttackWave({ request }: { request: Context }) {
    if (!request.remoteAddress) {
      // Cannot report attack wave without IP address
      // Should not happen since AttackWaveDetector checks for remoteAddress
      return;
    }

    const samples = this.attackWaveDetector.getSamplesForIP(
      request.remoteAddress
    );

    const attack: DetectedAttackWave = {
      type: "detected_attack_wave",
      time: Date.now(),
      attack: {
        metadata: limitLengthMetadata(
          {
            samples: JSON.stringify(samples),
          },
          4096
        ),
        user: request.user,
      },
      request: {
        ipAddress: request.remoteAddress,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : undefined,
        source: request.source,
      },
      agent: this.getAgentInfo(),
    };

    if (this.token) {
      const promise = this.api
        .report(this.token, attack, this.timeoutInMS)
        .catch(() => {
          this.logger.log("Failed to report attack wave");
        });
      this.pendingEvents.onAPICall(promise);
    }
  }
}
