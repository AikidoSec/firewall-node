import { Kind } from "../Attack";
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

type DetectedAttack = {
  type: "detected_attack";
  request: {
    method: string | undefined;
    ipAddress: string | undefined;
    userAgent: string | undefined;
    url: string | undefined;
    headers: Record<string, string | string[]>;
    body: string | undefined;
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

type ModuleStats = {
  attacksDetected: {
    total: number;
    blocked: number;
  };
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
    modules: Record<string, ModuleStats>;
    startedAt: number;
    endedAt: number;
    requests: {
      total: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
    };
  };
  agent: AgentInfo;
  time: number;
};

export type Event = Started | DetectedAttack | Heartbeat;
