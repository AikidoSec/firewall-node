import { request } from "undici";
import { Source } from "./Source";

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
};

type Event = Installed | Blocked;

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
