import { getInstance } from "../../AgentSingleton";
import { bindContext, getContext } from "../../Context";
import { inspectArgs } from "../wrapExport";
import { getFileCallbackInfo, getFunctionCallbackInfo } from "./instructions";

export { __zen_wrapMethodCallResult } from "./taintTracking";

export function __instrumentInspectArgs(
  id: string,
  args: IArguments | unknown[],
  pkgVersion: string,
  subject: unknown // "This" of the method being called
) {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  const context = getContext();

  const cbInfo = getFunctionCallbackInfo(id);
  if (!cbInfo) {
    return;
  }

  if (typeof cbInfo.funcs.inspectArgs === "function") {
    inspectArgs.call(
      subject,
      Array.from(args),
      cbInfo.funcs.inspectArgs,
      context,
      agent,
      {
        name: cbInfo.pkgName,
        version: pkgVersion,
        type: "external",
      },
      cbInfo.methodName,
      cbInfo.operationKind
    );
  }
}

export function __instrumentModifyArgs(
  id: string,
  args: unknown[],
  subject: unknown // "This" of the method being called
): unknown[] {
  if (!Array.isArray(args)) {
    return [];
  }

  const agent = getInstance();
  if (!agent) {
    return args;
  }

  const cbInfo = getFunctionCallbackInfo(id);

  if (
    !cbInfo ||
    !cbInfo.funcs ||
    typeof cbInfo.funcs.modifyArgs !== "function"
  ) {
    return args;
  }

  try {
    const newArgs = cbInfo.funcs.modifyArgs(args, agent, subject);
    // Only return the new arguments if they are an array
    if (Array.isArray(newArgs)) {
      if (!cbInfo.funcs.bindContext) {
        return newArgs;
      }

      // Ensure that all functions in the new arguments are bound to the current execution context (only if bindContext is true)
      return newArgs.map((arg) => {
        if (typeof arg === "function") {
          return bindContext(arg as () => unknown);
        }
        return arg;
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapMethod(
        cbInfo.pkgName,
        cbInfo.methodName,
        error
      );
    }
  }

  return args;
}

export function __instrumentModifyReturnValue(
  id: string,
  args: IArguments | unknown[],
  returnValue: unknown,
  subject: unknown // "This" of the method being called
): unknown {
  const agent = getInstance();
  if (!agent) {
    return args;
  }

  const cbInfo = getFunctionCallbackInfo(id);

  if (
    !cbInfo ||
    !cbInfo.funcs ||
    typeof cbInfo.funcs.modifyReturnValue !== "function"
  ) {
    return returnValue;
  }

  try {
    return cbInfo.funcs.modifyReturnValue(
      Array.from(args),
      returnValue,
      agent,
      subject
    );
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapMethod(
        cbInfo.pkgName,
        cbInfo.methodName,
        error
      );
    }
  }

  return returnValue;
}

export function __instrumentAccessLocalVariables(
  id: string,
  vars: unknown[]
): void {
  const cbInfo = getFileCallbackInfo(id);

  if (!cbInfo || typeof cbInfo.localVariableAccessCb !== "function") {
    return;
  }

  try {
    cbInfo.localVariableAccessCb(vars, {
      name: cbInfo.pkgName,
      type: "external",
    });
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(cbInfo.pkgName, error);
    }
  }
}
