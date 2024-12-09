import { Kind } from "../Attack";
import { Source } from "../Source";

export type InterceptorResult = {
  operation: string;
  kind: Kind;
  source: Source;
  pathsToPayload: string[];
  metadata: Record<string, string>;
  payload: unknown;
} | void;
