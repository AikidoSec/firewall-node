import { resolve } from "path";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { escapeHTML } from "../../helpers/escapeHTML";
import type { Agent } from "../Agent";
import { OperationKind } from "../api/Event";
import { attackKindHumanName } from "../Attack";
import { type Context, getContext, updateContext } from "../Context";
import {
  AttackResult,
  InterceptorResult,
  isAttackResult,
  isBlockOutboundConnectionResult,
  isIdorViolationResult,
} from "./InterceptorResult";
import type { PartialWrapPackageInfo } from "./WrapPackageInfo";
import { cleanError } from "../../helpers/cleanError";
import {
  captureStack,
  isStackFromSourceMapLookup,
} from "../../helpers/captureStack";

// Used for cleaning up the stack trace
const libraryRoot = resolve(__dirname, "../..");

export function onInspectionInterceptorResult(
  context: ReturnType<typeof getContext>,
  agent: Agent,
  result: InterceptorResult,
  pkgInfo: PartialWrapPackageInfo,
  operation: string,
  kind: OperationKind | undefined
) {
  const attack = getAttack(result);

  // Only read when an attack was detected, so the normal path is not affected
  const stack = attack && context ? captureStack() : undefined;
  if (stack && isStackFromSourceMapLookup(stack)) {
    // Node internals building a stack trace, not an attack by the app
    return;
  }

  const isBypassedRequest = agent.getConfig().isBypassedRequest(context);

  if (kind) {
    agent.getInspectionStatistics().onInspectedCall({
      operation: operation,
      kind: kind,
      attackDetected: !isBypassedRequest && !!result,
      blocked: agent.shouldBlock(),
      withoutContext: !context,
    });
  }

  if (isBypassedRequest) {
    return;
  }

  if (isIdorViolationResult(result)) {
    // The IDOR violation always throws, so report the attack detected in the same query first
    if (result.attack && context) {
      reportAttack(context, agent, result.attack, pkgInfo, stack!);
    }

    throw cleanError(new Error(result.message));
  }

  if (isBlockOutboundConnectionResult(result)) {
    throw cleanError(
      new Error(
        `Zen has blocked an outbound connection: ${result.operation}(...) to ${escapeHTML(result.hostname)}`
      )
    );
  }

  if (isAttackResult(result) && context) {
    reportAttack(context, agent, result, pkgInfo, stack!);

    if (agent.shouldBlock()) {
      throw cleanError(
        new Error(
          `Zen has blocked ${attackKindHumanName(result.kind)}: ${result.operation}(...) originating from ${result.source}${escapeHTML((result.pathsToPayload || []).join())}`
        )
      );
    }
  }
}

function getAttack(result: InterceptorResult): AttackResult | undefined {
  if (isIdorViolationResult(result)) {
    return result.attack;
  }

  if (isAttackResult(result)) {
    return result;
  }

  return undefined;
}

function reportAttack(
  context: Context,
  agent: Agent,
  attack: AttackResult,
  pkgInfo: PartialWrapPackageInfo,
  stack: string
) {
  // Flag request as having an attack detected
  updateContext(context, "attackDetected", true);

  agent.onDetectedAttack({
    module: pkgInfo.name,
    operation: attack.operation,
    kind: attack.kind,
    source: attack.source,
    blocked: agent.shouldBlock(),
    stack: cleanupStackTrace(stack, libraryRoot),
    paths: attack.pathsToPayload,
    metadata: attack.metadata,
    request: context,
    payload: attack.payload,
  });
}
