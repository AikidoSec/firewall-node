import { getInstance } from "../../AgentSingleton";
import { getContext } from "../../Context";
import { inspectArgs } from "../wrapExport";
import { getPackageCallbackInfo } from "./instructions";
import { getBuiltinModuleWithoutPatching } from "./processGetBuiltin";

export function __instrumentInspectArgs(
  id: string,
  args: unknown[],
  pkgVersion: string,
  subject: unknown // "This" of the method being called
) {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  const context = getContext();

  const cbInfo = getPackageCallbackInfo(id);
  if (!cbInfo) {
    return;
  }

  if (typeof cbInfo.funcs.inspectArgs === "function") {
    inspectArgs.call(
      subject,
      args,
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

  const cbInfo = getPackageCallbackInfo(id);

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
      return newArgs;
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
  args: unknown[],
  returnValue: unknown,
  subject: unknown // "This" of the method being called
): unknown {
  const agent = getInstance();
  if (!agent) {
    return args;
  }

  const cbInfo = getPackageCallbackInfo(id);

  if (
    !cbInfo ||
    !cbInfo.funcs ||
    typeof cbInfo.funcs.modifyReturnValue !== "function"
  ) {
    return returnValue;
  }

  try {
    return cbInfo.funcs.modifyReturnValue(args, returnValue, agent, subject);
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

export function __getBuiltinModuleWithoutPatching(id: string) {
  return getBuiltinModuleWithoutPatching(id);
}
