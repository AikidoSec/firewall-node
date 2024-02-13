import { Source } from "./Source";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";

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
  preventedPrototypePollution: boolean;
  os: {
    name: string;
    version: string;
  };
  nodeEnv: string;
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
  report(token: Token, event: Event): Promise<void>;
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
        return;
      }

      this.events.push(event);
    }

    await this.api.report(token, event);
  }
}

export class APIFetch implements API {
  constructor(
    private readonly reportingUrl: URL,
    private readonly timeoutInMS: number = 5000
  ) {}

  private async fetch(
    url: string,
    {
      signal,
      method,
      body,
      headers,
    }: {
      signal: AbortSignal;
      method: string;
      headers: Record<string, string>;
      body: string;
    }
  ) {
    const request = url.startsWith("https://") ? requestHttps : requestHttp;

    return new Promise<Response | void>((resolve) => {
      const req = request(
        url,
        {
          method,
          headers,
          signal,
        },
        (res) => {
          res.on("data", () => {});
          res.on("end", () => {
            resolve();
          });
        }
      );

      req.on("error", () => {
        resolve();
      });

      req.write(body);
      req.end();
    });
  }

  async report(token: Token, event: Event) {
    const abort = new AbortController();
    await Promise.race([
      this.fetch(this.reportingUrl.toString(), {
        signal: abort.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.asString()}`,
        },
        body: JSON.stringify(event),
      }),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          abort.abort();
          resolve();
        }, this.timeoutInMS)
      ),
    ]);
  }
}

export class APIForTesting implements API {
  private readonly events: Event[] = [];

  async report(token: Token, event: Event) {
    this.events.push(event);
  }

  getEvents() {
    return this.events;
  }
}
