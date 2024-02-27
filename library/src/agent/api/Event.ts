import { Source } from "../Source";

export type AgentInfo = {
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
  serverless: boolean;
};

type Started = {
  type: "started";
  agent: AgentInfo;
  time: number;
};

export type Kind = "nosql_injection" | "sql_injection";

type DetectedAttack = {
  type: "detected_attack";
  request: {
    method: string | undefined;
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
