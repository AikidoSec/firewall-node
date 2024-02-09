import { readFileSync } from "node:fs";
import { hostname, platform, release } from "node:os";
import { API, AgentInfo, Token, Stats, Kind } from "./API";
import { IDGenerator } from "./IDGenerator";
import { Integration } from "./integrations/Integration";
import { Logger } from "./Logger";
import { Context } from "./Context";
import { resolve } from "path";
import { satisfiesVersion } from "./satisfiesVersion";
import { Source } from "./Source";
import { address } from "ip";

export class Agent {
  private heartbeatIntervalInMS = 60 * 1000;
  private interval: NodeJS.Timeout | undefined = undefined;
  private started = false;
  private info: AgentInfo | undefined = undefined;
  private stats: Stats = {};

  constructor(
    private readonly block: boolean,
    private readonly logger: Logger,
    private readonly api: API,
    private readonly token: Token | undefined,
    private readonly integrations: Integration[],
    private readonly idGenerator: IDGenerator
  ) {}

  shouldBlock() {
    return this.block;
  }

  inspectedCall({
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

  preventedPrototypePollution() {
    // Will be sent in the next heartbeat
    if (this.info) {
      this.info.preventedPrototypePollution = true;
    }
  }

  detectedAttack({
    module,
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
    if (this.token && this.info) {
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
            kind: "nosql_injection",
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
          agent: this.info,
        })
        .catch(() => {
          this.logger.log("Failed to report attack");
        });
    }
  }

  private heartbeat() {
    if (this.token && this.info) {
      this.logger.log("Reporting stats...");
      this.api
        .report(this.token, {
          type: "heartbeat",
          time: Date.now(),
          agent: this.info,
          stats: this.stats,
        })
        .catch((error) => {
          this.logger.log("Failed to report stats");
        });
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  start() {
    if (this.started) {
      this.logger.log("Agent already started!");
      return;
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

    try {
      const json: {
        version: string;
        optionalDependencies: Record<string, string>;
      } = JSON.parse(
        readFileSync(
          resolve(__dirname, "..", "package.json"),
          "utf-8"
        ).toString()
      );

      if (!json.version) {
        throw new Error("Missing version in package.json");
      }

      const optionalDeps = json.optionalDependencies || {};
      const installed: Record<string, string> = {};

      this.integrations.forEach((integration) => {
        const pkgName = integration.getPackageName();

        if (!optionalDeps[pkgName]) {
          return;
        }

        const json: { version: string } = require(`${pkgName}/package.json`);

        if (!json.version) {
          return;
        }

        if (!satisfiesVersion(optionalDeps[pkgName], json.version)) {
          this.logger.log(
            `Skipping ${pkgName} because it does not satisfy the version range ${optionalDeps[pkgName]}`
          );
        }

        integration.setup();
        installed[pkgName] = json.version;
      });

      this.info = {
        id: this.idGenerator.generate(),
        dryMode: !this.block,
        hostname: hostname() || "",
        version: json.version,
        ipAddress: address() || "",
        packages: installed,
        preventedPrototypePollution: false,
        nodeEnv: process.env.NODE_ENV || "",
        os: {
          name: platform(),
          version: release(),
        },
      };
    } catch (error: any) {
      this.logger.log("Failed to start agent: " + error.message);
    }

    const installed = this.integrations.map((integration) => {
      return this.info && !!this.info.packages[integration.getPackageName()];
    });

    if (
      this.token &&
      this.info &&
      installed.every((initialised) => initialised)
    ) {
      this.api
        .report(this.token, {
          type: "started",
          time: Date.now(),
          agent: this.info,
        })
        .catch((error) => {
          this.logger.log("Failed to report started event");
        });

      // TODO: Check if possible in Lambda?
      this.interval = setInterval(
        this.heartbeat.bind(this),
        this.heartbeatIntervalInMS
      );

      process.on("exit", this.stop.bind(this));
    }
  }
}
