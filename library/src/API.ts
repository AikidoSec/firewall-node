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

export type AgentInfo = {
  id: string;
  dryMode: boolean;
  hostname: string;
  version: string;
  packages: Record<string, string>;
  ipAddress: string;
  os: {
    name: string;
    version: string;
  };
};

type Started = {
  type: "started";
  agent: AgentInfo;
  time: number;
};

export type Kind = "nosql_injection";

type DetectedAttack = {
  type: "detected_attack";
  request: {
    method: string;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    url: string | undefined;
  };
  attack: {
    kind: Kind;
    module: string;
    blocked: boolean;
    source: Source;
    path: string;
    stack: string;
    metadata: Record<string, string>;
  };
  agent: AgentInfo;
  time: number;
};

type ModuleName = string;

export type Stats = Record<
  ModuleName,
  {
    blocked: number;
    allowed: number;
    withoutContext: number;
    total: number;
  }
>;

type Heartbeat = {
  type: "heartbeat";
  stats: Stats;
  agent: AgentInfo;
  time: number;
};

export type Event = Started | DetectedAttack | Heartbeat;

export interface API {
  report(token: Token, event: Event): Promise<boolean>;
}

type ThrottleOptions = { maxEventsPerInterval: number; intervalInMs: number };

export class APIThrottled implements API {
  private readonly maxEventsPerInterval: number;
  private readonly intervalInMs: number;
  private events: Event[] = [];

  constructor(
    private readonly api: API,
    { maxEventsPerInterval, intervalInMs }: ThrottleOptions
  ) {
    this.maxEventsPerInterval = maxEventsPerInterval;
    this.intervalInMs = intervalInMs;
  }

  async report(token: Token, event: Event) {
    if (event.type === "detected_attack") {
      const currentTime = Date.now();

      this.events = this.events.filter(
        (e) => e.time > currentTime - this.intervalInMs
      );

      if (this.events.length >= this.maxEventsPerInterval) {
        return false;
      }

      this.events.push(event);
    }

    return await this.api.report(token, event);
  }
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
