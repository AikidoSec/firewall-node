import { readFileSync } from "node:fs";
import { hostname, platform, release } from "node:os";
import { API, AgentInfo, Token } from "./API";
import { Integration } from "./integrations/Integration";
import { Logger } from "./Logger";
import { Context } from "./Context";
import { resolve } from "path";
import { Source } from "./Source";
import { satisfies } from "semver";
import { address } from "ip";

export class Agent {
  private started = false;
  private info: AgentInfo | undefined = undefined;

  constructor(
    private readonly block: boolean,
    private readonly logger: Logger,
    private readonly api: API,
    private readonly token: Token | undefined,
    private readonly integrations: Integration[]
  ) {}

  shouldBlock() {
    return this.block;
  }

  detectedAttack({
    blocked,
    source,
    request,
    stack,
    path,
    metadata,
  }: {
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
          attack: {
            blocked: blocked,
            path: path,
            stack: stack,
            source: source,
            metadata: metadata,
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

        if (!satisfies(json.version, optionalDeps[pkgName])) {
          this.logger.log(
            `Skipping ${pkgName} because it does not satisfy the version range ${optionalDeps[pkgName]}`
          );
        }

        integration.setup();
        installed[pkgName] = json.version;
      });

      this.info = {
        hostname: hostname(),
        version: json.version,
        ipAddress: address(),
        packages: installed,
        osName: platform(),
        osVersion: release(),
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
          type: "installed",
          agent: this.info,
        })
        .catch((error) => {
          this.logger.log("Failed to report installed event");
        });
    }
  }
}
