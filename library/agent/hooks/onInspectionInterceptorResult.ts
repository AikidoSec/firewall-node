import { resolve } from "path";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { escapeHTML } from "../../helpers/escapeHTML";
import type { Agent } from "../Agent";
import { attackKindHumanName } from "../Attack";
import { getContext, updateContext } from "../Context";
import type { InterceptorResult } from "./InterceptorResult";
import type { WrapPackageInfo } from "./WrapPackageInfo";
import { cleanError } from "../../helpers/cleanError";

// Used for cleaning up the stack trace
const libraryRoot = resolve(__dirname, "../..");

export function onInspectionInterceptorResult(
  context: ReturnType<typeof getContext>,
  agent: Agent,
  result: InterceptorResult,
  pkgInfo: WrapPackageInfo,
  start: number
) {
  const end = performance.now();
  agent.getInspectionStatistics().onInspectedCall({
    sink: pkgInfo.name,
    attackDetected: !!result,
    blocked: agent.shouldBlock(),
    durationInMs: end - start,
    withoutContext: !context,
  });

  const isAllowedIP =
    context &&
    context.remoteAddress &&
    agent.getConfig().isAllowedIP(context.remoteAddress);

  if (result && context && !isAllowedIP) {
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
