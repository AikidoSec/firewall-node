import { resolve } from "path";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { escapeHTML } from "../../helpers/escapeHTML";
import { wrap } from "../../helpers/wrap";
import { Agent } from "../Agent";
import { getInstance } from "../AgentSingleton";
import { attackKindHumanName } from "../Attack";
import { bindContext, getContext, updateContext } from "../Context";
import { InterceptorResult } from "./InterceptorResult";
import { WrapPackageInfo } from "./WrapPackageInfo";

type InspectArgsInterceptor = (
  args: unknown[],
  agent: Agent,
  subject: unknown
) => InterceptorResult | void;

type ModifyArgsInterceptor = (args: unknown[], agent: Agent) => unknown[];

type ModifyReturnValueInterceptor = (
  args: unknown[],
  returnValue: unknown,
  agent: Agent
) => unknown;

export type InterceptorObject = {
  inspectArgs?: InspectArgsInterceptor;
  modifyArgs?: ModifyArgsInterceptor;
  modifyReturnValue?: ModifyReturnValueInterceptor;
};

const libraryRoot = resolve(__dirname, "../..");

export function wrapExport(
  subject: unknown,
  methodName: string,
  pkgInfo: WrapPackageInfo,
  interceptors: InterceptorObject
) {
  const agent = getInstance();
  if (!agent) {
    throw new Error("Can not wrap exports if agent is not initialized");
  }

  try {
    wrap(subject, methodName, function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        let args = Array.from(arguments);
        const context = getContext();

        // Run inspectArgs interceptor if provided
        if (typeof interceptors.inspectArgs === "function") {
          // Bind context to functions in arguments
          for (let i = 0; i < args.length; i++) {
            if (typeof args[i] === "function") {
              args[i] = bindContext(args[i]);
            }
          }

          inspectArgs.call(
            // @ts-expect-error We don't now the type of this
            this,
            args,
            interceptors.inspectArgs,
            context,
            agent,
            pkgInfo,
            methodName
          );
        }

        // Run modifyArgs interceptor if provided
        if (typeof interceptors.modifyArgs === "function") {
          try {
            args = interceptors.modifyArgs(args, agent);
          } catch (error: any) {
            agent.onErrorThrownByInterceptor({
              error: error,
              method: methodName,
              module: pkgInfo.name,
            });
          }
        }

        const returnVal = original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          args
        );

        // Run modifyReturnValue interceptor if provided
        if (typeof interceptors.modifyReturnValue === "function") {
          try {
            return interceptors.modifyReturnValue(args, returnVal, agent);
          } catch (error: any) {
            agent.onErrorThrownByInterceptor({
              error: error,
              method: methodName,
              module: pkgInfo.name,
            });
          }
        }

        return returnVal;
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(pkgInfo.name, methodName);
  }
}

function inspectArgs(
  args: unknown[],
  interceptor: InspectArgsInterceptor,
  context: ReturnType<typeof getContext>,
  agent: Agent,
  pkgInfo: WrapPackageInfo,
  methodName: string
) {
  if (context) {
    const match = agent.getConfig().getEndpoint(context);

    if (match && match.endpoint.forceProtectionOff) {
      return;
    }
  }

  const start = performance.now();
  let result: InterceptorResult = undefined;

  try {
    result = interceptor(
      args,
      agent,
      // @ts-expect-error We don't now the type of this
      this
    );
  } catch (error: any) {
    agent.getInspectionStatistics().interceptorThrewError(pkgInfo.name);
    agent.onErrorThrownByInterceptor({
      error: error,
      method: methodName,
      module: pkgInfo.name,
    });
  }

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
      path: result.pathToPayload,
      metadata: result.metadata,
      request: context,
      payload: result.payload,
    });

    if (agent.shouldBlock()) {
      throw new Error(
        `Aikido firewall has blocked ${attackKindHumanName(result.kind)}: ${result.operation}(...) originating from ${result.source}${escapeHTML(result.pathToPayload)}`
      );
    }
  }
}
