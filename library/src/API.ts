import { request } from "undici";
import { Source } from "./Source";
import { createHash } from "node:crypto";

export class Token {
  constructor(private readonly token: string) {
    if (!this.token) {
      throw new Error("Token cannot be empty");
    }
  }

  toString() {
    throw new Error("Please use asString() instead");
  }

  asString() {
    return this.token;
  }
}

export type Kind = "nosql-injection";

type Installed = {
  type: "installed";
  hostname: string;
  version: string;
};

type Blocked = {
  type: "blocked";
  kind: Kind;
  ipAddress: string | undefined;
  userAgent: string | undefined;
  url: string | undefined;
  method: string;
  source: Source;
  path: string;
  stack: string;
  metadata: Record<string, string>;
  version: string;
  hostname: string;
};

export type Event = Installed | Blocked;

export interface API {
  report(token: Token, event: Event): Promise<boolean>;
}

export class APIFetch implements API {
  constructor(private readonly reportingUrl: URL) {}

  async report(token: Token, event: Event) {
    const response = await request(this.reportingUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.asString()}`,
      },
      body: JSON.stringify(event),
    });

    return response.statusCode === 200;
  }
}

export class APIThrottled implements API {
  private set = new Set<string>();

  constructor(private readonly api: API) {}

  getFingerprint(event: Blocked) {
    const parts: string[] = [event.source, event.path];
    if (event.ipAddress) {
      parts.push(event.ipAddress);
    }
    if (event.method) {
      parts.push(event.method);
    }
    if (event.url) {
      parts.push(event.url);
    }
    if (event.userAgent) {
      parts.push(event.userAgent);
    }
    for (const key of Object.keys(event.metadata)) {
      parts.push(`${key}:${event.metadata[key]}`);
    }

    return createHash("md5").update(parts.join(" ")).digest("hex");
  }

  async report(token: Token, event: Event) {
    if (event.type === "blocked") {
      const fingerprint = this.getFingerprint(event);

      if (this.set.has(fingerprint)) {
        return false;
      }

      // Prevent memory overflow
      if (this.set.size > 100) {
        this.set.clear();
      }

      this.set.add(fingerprint);
    }

    return await this.api.report(token, event);
  }
}

export class APIForTesting implements API {
  private readonly events: Event[] = [];

  async report(token: Token, event: Event) {
    this.events.push(event);

    return true;
  }

  getEvents() {
    return this.events;
  }
}
