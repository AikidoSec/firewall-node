import { isPlainObject } from "../../helpers/isPlainObject";
import { Kind } from "../Attack";
import { Source } from "../Source";

export type BlockOutboundConnectionResult = {
  operation: string;
  hostname: string;
};

export type AttackResult = {
  operation: string;
  kind: Kind;
  source: Source;
  pathsToPayload: string[];
  metadata: Record<string, string>;
  payload: unknown;
};

export type IdorViolationResult = {
  idorViolation: true;
  message: string;
};

export type ShellViolationResult = {
  shellViolation: true;
  message: string;
};

export type InterceptorResult =
  | AttackResult
  | BlockOutboundConnectionResult
  | IdorViolationResult
  | ShellViolationResult
  | void;

export function isBlockOutboundConnectionResult(
  result: InterceptorResult
): result is BlockOutboundConnectionResult {
  return isPlainObject(result) && "hostname" in result;
}

export function isAttackResult(
  result: InterceptorResult
): result is AttackResult {
  return isPlainObject(result) && "kind" in result;
}

export function isIdorViolationResult(
  result: InterceptorResult
): result is IdorViolationResult {
  return isPlainObject(result) && "idorViolation" in result;
}

export function isShellViolationResult(
  result: InterceptorResult
): result is ShellViolationResult {
  return isPlainObject(result) && "shellViolation" in result;
}
