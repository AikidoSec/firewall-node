/* eslint-disable max-lines-per-function */
import { resolve } from "path";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { escapeHTML } from "../../helpers/escapeHTML";
import type { Agent } from "../Agent";
import { OperationKind } from "../api/Event";
import { attackKindHumanName } from "../Attack";
import { getContext, updateContext } from "../Context";
import {
  InterceptorResult,
  isAttackResult,
  isBlockOutboundConnectionResult,
  isIdorViolationResult,
} from "./InterceptorResult";
import type { PartialWrapPackageInfo } from "./WrapPackageInfo";
import { cleanError } from "../../helpers/cleanError";

// Used for cleaning up the stack trace
const libraryRoot = resolve(__dirname, "../..");

export function onInspectionInterceptorResult(
  context: ReturnType<typeof getContext>,
  agent: Agent,
  result: InterceptorResult,
  pkgInfo: PartialWrapPackageInfo,
  start: number,
  operation: string,
  kind: OperationKind | undefined
) {
  const end = performance.now();

  if (kind) {
    agent.getInspectionStatistics().onInspectedCall({
      operation: operation,
      kind: kind,
      attackDetected: !!result,
      blocked: agent.shouldBlock(),
      durationInMs: end - start,
      withoutContext: !context,
    });
  }

  const isBypassedIP =
    context &&
    context.remoteAddress &&
    agent.getConfig().isBypassedIP(context.remoteAddress);

  if (isIdorViolationResult(result) && !isBypassedIP) {
    throw cleanError(new Error(result.message));
  }

  if (isBlockOutboundConnectionResult(result) && !isBypassedIP) {
    throw cleanError(
      new Error(
        `Zen has blocked an outbound connection: ${result.operation}(...) to ${escapeHTML(result.hostname)}`
      )
    );
  }

  if (isAttackResult(result) && context && !isBypassedIP) {
    // Flag request as having an attack detected
    updateContext(context, "attackDetected", true);

    agent.onDetectedAttack({
      module: pkgInfo.name,
      operation: result.operation,
      kind: result.kind,
      source: result.source,
      blocked: agent.shouldBlock(),
      stack: cleanupStackTrace(new Error().stack!, libraryRoot),
      paths: result.pathsToPayload,
      metadata: result.metadata,
      request: context,
      payload: result.payload,
    });

    if (agent.shouldBlock()) {
      throw cleanError(
        new Error(
          `Zen has blocked ${attackKindHumanName(result.kind)}: ${result.operation}(...) originating from ${result.source}${escapeHTML((result.pathsToPayload || []).join())}`
        )
      );
    }
  }
}
