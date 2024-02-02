import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { API, Instance, Token } from "./API";
import { Integration } from "./integrations/Integration";
import { Logger } from "./Logger";
import { Context } from "./Context";
import { resolve } from "path";
import { Source } from "./Source";
import { satisfies } from "semver";
import { address } from "ip";

export class Agent {
  private started = false;
  private instance: Instance | undefined = undefined;

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

  foundNoSQLInjection({
    source,
    request,
    stack,
    path,
    metadata,
  }: {
    source: Source;
    request: Context;
    stack: string;
    path: string;
    metadata: Record<string, string>;
  }) {
    if (this.token && this.instance) {
      this.api
        .report(this.token, {
          type: "nosql-injection",
          blocked: true,
          ipAddress: request.remoteAddress,
          userAgent:
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"]
              : undefined,
          url: request.url as string,
          method: request.method,
          path: path,
          stack: stack,
          source: source,
          metadata: metadata,
          instance: this.instance,
        })
        .catch(() => {
          this.logger.log("Failed to report NoSQL injection");
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

      this.instance = {
        hostname: hostname(),
        version: json.version,
        ipAddress: address(),
        packages: installed,
      };
    } catch (error: any) {
      this.logger.log("Failed to start agent: " + error.message);
    }

    const installed = this.integrations.map((integration) => {
      return (
        this.instance && !!this.instance.packages[integration.getPackageName()]
      );
    });

    if (
      this.token &&
      this.instance &&
      installed.every((initialised) => initialised)
    ) {
      this.api
        .report(this.token, {
          type: "installed",
          instance: this.instance,
        })
        .catch((error) => {
          this.logger.log("Failed to report installed event");
        });
    }
  }
}
