import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { API, Kind, Source, Token } from "./API";
import { Logger } from "./Logger";
import { Request } from "./RequestContext";
import { resolve } from "path";

// Lambda instances are reused, so we need to make sure we only report the installed event once
export let INSTALLED = false;

export class Aikido {
  private version: string | undefined = undefined;

  constructor(
    private readonly logger: Logger,
    private readonly api: API,
    private readonly token: Token | undefined
  ) {
    if (!this.token) {
      this.logger.log("No token provided, disabling reporting");
    }
  }

  private getVersion() {
    if (this.version) {
      return this.version;
    }

    const entrypoint = require.resolve("@aikidosec/rasp");
    const json: { version: string } = JSON.parse(
      readFileSync(
        resolve(entrypoint, "..", "..", "package.json"),
        "utf-8"
      ).toString()
    );
    this.version = json.version;

    return json.version;
  }

  installed() {
    if (INSTALLED) {
      return;
    }

    INSTALLED = true;

    if (this.token) {
      this.api
        .report(this.token, {
          type: "installed",
          hostname: hostname(),
          version: this.getVersion(),
        })
        .catch((error) => {
          this.logger.log("Failed to report event: " + error.message);
        });
    }
  }

  report({
    kind,
    source,
    request,
    stack,
    metadata,
  }: {
    kind: Kind;
    source: Source;
    request: Request;
    stack: string;
    metadata: Record<string, string>;
  }) {
    if (this.token) {
      this.api
        .report(this.token, {
          type: "blocked",
          kind: kind,
          ipAddress: request.remoteAddress,
          userAgent:
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"]
              : undefined,
          url: request.url as string,
          method: request.method,
          stack: stack,
          source: source,
          metadata: metadata,
        })
        .catch((error) => {
          this.logger.log("Failed to report event: " + error.message);
        });
    }
  }
}
