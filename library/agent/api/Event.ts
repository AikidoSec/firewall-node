import { APISpec } from "../api-discovery/getApiInfo";
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
  platform: {
    version: string;
    arch: string;
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
  request:
    | {
        method: string | undefined;
        ipAddress: string | undefined;
        userAgent: string | undefined;
        url: string | undefined;
        source: string;
        route: string | undefined;
      }
    | undefined;
  attack: {
    kind: Kind;
    operation: string;
    module: string;
    blocked: boolean;
    source: Source | undefined;
    path: string;
    stack: string;
    payload: string | undefined;
    metadata: Record<string, string>;
    user: User | undefined;
  };
  agent: AgentInfo;
  time: number;
};

export type OperationKind =
  | "sql_op"
  | "nosql_op"
  | "outgoing_http_op"
  | "fs_op"
  | "exec_op"
  | "deserialize_op"
  | "graphql_op"
  | "eval_op"
  | "ai_op";

type OperationStats = {
  kind: OperationKind;
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
    operations: Record<string, OperationStats>;
    startedAt: number;
    endedAt: number;
    sqlTokenizationFailures: number;
    requests: {
      total: number;
      aborted: number;
      rateLimited: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
      attackWaves: {
        total: number;
        blocked: number;
      };
    };
    userAgents: {
      breakdown: Record<string, number>;
    };
    ipAddresses: {
      breakdown: Record<string, number>;
    };
  };
  ai: {
    provider: string;
    model: string;
    calls: number;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    routes: {
      path: string;
      method: string;
      calls: number;
      tokens: {
        input: number;
        output: number;
        total: number;
      };
    }[];
  }[];
  packages: {
    name: string;
    version: string;
    requiredAt: number;
  }[];
  hostnames: { hostname: string; port: number | undefined; hits: number }[];
  routes: {
    path: string;
    method: string;
    hits: number;
    rateLimitedCount: number;
    graphql?: { type: "query" | "mutation"; name: string };
    apispec: APISpec;
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
  middlewareInstalled?: boolean;
};

export type DetectedAttackWave = {
  type: "detected_attack_wave";
  request: {
    ipAddress: string;
    userAgent: string | undefined;
    source: string;
  };
  attack: {
    metadata: Record<string, string>;
    user: User | undefined;
  };
  agent: AgentInfo;
  time: number;
};

export type Event = Started | DetectedAttack | Heartbeat | DetectedAttackWave;
