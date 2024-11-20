import { Kind } from "../Attack";
import { Source } from "../Source";

export type InterceptorResult = {
  operation: string;
  kind: Kind;
  source: Source;
  pathToPayload: string;
  metadata: Record<string, string>;
  payload: unknown;
} | void;
