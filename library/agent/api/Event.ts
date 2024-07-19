import { Kind } from "../Attack";
import { Source } from "../Source";

export type AgentInfo = {
  dryMode: boolean;
  hostname: string;
  version: string;
  library: string;
  packages: Record<string, string>;
  ipAddress: string;
  preventedPrototypePollution: boolean;
  incompatiblePackages: {
    prototypePollution: Record<string, string>;
  };
  os: {
    name: string;
    version: string;
  };
  nodeEnv: string;
  serverless: boolean;
  stack: string[];
};

type Started = {
  type: "started";
  agent: AgentInfo;
  time: number;
};

export type User = {
  id: string;
  name?: string;
};

export type DetectedAttack = {
  type: "detected_attack";
  request: {
    method: string | undefined;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    url: string | undefined;
    headers: Record<string, string | string[]>;
    body: string | undefined;
    source: string;
    route: string | undefined;
  };
  attack: {
    kind: Kind;
    operation: string;
    module: string;
    blocked: boolean;
    source: Source;
    path: string;
    stack: string;
    payload: string;
    metadata: Record<string, string>;
    user: User | undefined;
  };
  agent: AgentInfo;
  time: number;
};

type MonitoredSinkStats = {
  attacksDetected: {
    total: number;
    blocked: number;
  };
  interceptorThrewError: number;
  withoutContext: number;
  total: number;
  compressedTimings: {
    averageInMS: number;
    percentiles: Record<string, number>;
    compressedAt: number;
  }[];
};

type Heartbeat = {
  type: "heartbeat";
  stats: {
    sinks: Record<string, MonitoredSinkStats>;
    startedAt: number;
    endedAt: number;
    requests: {
      total: number;
      aborted: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
    };
  };
  hostnames: { hostname: string; port: number | undefined }[];
  routes: {
    path: string;
    method: string;
    hits: number;
    graphql?: { type: "query" | "mutation"; name: string };
  }[];
  users: {
    id: string;
    name: string | undefined;
    lastIpAddress: string | undefined;
    firstSeenAt: number;
    lastSeenAt: number;
  }[];
  agent: AgentInfo;
  time: number;
};

export type Event = Started | DetectedAttack | Heartbeat;
