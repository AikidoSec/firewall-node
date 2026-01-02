/* eslint-disable max-lines-per-function */
import type { Agent } from "../Agent";
import { getInstance } from "../AgentSingleton";
import { OperationKind } from "../api/Event";
import { bindContext, getContext } from "../Context";
import { type InterceptorResult, isAttackResult } from "./InterceptorResult";
import type { PartialWrapPackageInfo } from "./WrapPackageInfo";
import { wrapDefaultOrNamed } from "./wrapDefaultOrNamed";
import { onInspectionInterceptorResult } from "./onInspectionInterceptorResult";

export type InspectArgsInterceptor = (
  args: unknown[],
  agent: Agent,
  subject: unknown
) => InterceptorResult | void;

export type ModifyArgsInterceptor = (
  args: unknown[],
  agent: Agent,
  subject: unknown
) => unknown[];

export type ModifyReturnValueInterceptor = (
  args: unknown[],
  returnValue: unknown,
  agent: Agent,
  subject: unknown
) => unknown;

export type InterceptorObject = {
  inspectArgs?: InspectArgsInterceptor;
  modifyArgs?: ModifyArgsInterceptor;
  modifyReturnValue?: ModifyReturnValueInterceptor;
  // Set the kind of operation for the wrapped function/method
  // This will be used to collect stats
  // For sources, this will often be undefined
  kind: OperationKind | undefined;
};

/**
 * Wraps a function with the provided interceptors.
 * If the function is not part of an object, like default exports, pass undefined as methodName and the function as subject.
 */
export function wrapExport(
  subject: unknown,
  methodName: string | undefined,
  pkgInfo: PartialWrapPackageInfo,
  interceptors: InterceptorObject
) {
  const agent = getInstance();
  if (!agent) {
    throw new Error("Can not wrap exports if agent is not initialized");
  }

  try {
    return wrapDefaultOrNamed(
      subject,
      methodName,
      function wrap(original: Function) {
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
              methodName || "",
              interceptors.kind
            );
          }

          // Run modifyArgs interceptor if provided
          if (typeof interceptors.modifyArgs === "function") {
            try {
              args = interceptors.modifyArgs(
                args,
                agent,
                // @ts-expect-error We don't now the type of
                this
              );
            } catch (error: any) {
              agent.onErrorThrownByInterceptor({
                error: error,
                method: methodName || "default export",
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
              return interceptors.modifyReturnValue(
                args,
                returnVal,
                agent,
                // @ts-expect-error We don't now the type of
                this
              );
            } catch (error: any) {
              agent.onErrorThrownByInterceptor({
                error: error,
                method: methodName || "default export",
                module: pkgInfo.name,
              });
            }
          }

          return returnVal;
        };
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      agent.onFailedToWrapMethod(
        pkgInfo.name,
        methodName || "default export",
        error
      );
    }
  }
}

export function inspectArgs(
  args: unknown[],
  interceptor: InspectArgsInterceptor,
  context: ReturnType<typeof getContext>,
  agent: Agent,
  pkgInfo: PartialWrapPackageInfo,
  methodName: string,
  kind: OperationKind | undefined
) {
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
    agent.onErrorThrownByInterceptor({
      error: error,
      method: methodName,
      module: pkgInfo.name,
    });
  }

  // When forceProtectionOff is enabled, skip attack detection
  // but still allow outbound connection blocking
  if (context && isAttackResult(result)) {
    const matches = agent.getConfig().getEndpoints(context);

    if (matches.find((match) => match.forceProtectionOff)) {
      return;
    }
  }

  onInspectionInterceptorResult(
    context,
    agent,
    result,
    pkgInfo,
    start,
    `${pkgInfo.name}.${methodName}`,
    kind
  );
}
