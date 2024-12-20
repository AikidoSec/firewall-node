import { Kind } from "../Attack";
import { Source } from "../Source";

export type InterceptorResultSource = Source | "route";

export type InterceptorResult = {
  operation: string;
  kind: Kind;
  source: InterceptorResultSource;
  pathsToPayload: string[];
  metadata: Record<string, string>;
  payload: unknown;
} | void;
