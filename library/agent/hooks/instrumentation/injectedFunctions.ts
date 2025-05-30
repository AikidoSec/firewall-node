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
    agent.onFailedToWrapMethod(id, id, new Error("No callback info found"));
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

export function __instrumentModifyArgs(id: string, args: unknown[]): unknown[] {
  if (!Array.isArray(args)) {
    return [];
  }

  const agent = getInstance();
  if (!agent) {
    return args;
  }

  try {
    const cbInfo = getPackageCallbackInfo(id);

    if (cbInfo && typeof cbInfo.funcs.modifyArgs === "function") {
      const newArgs = cbInfo.funcs.modifyArgs(args, agent);
      // Only return the new arguments if they are an array
      if (Array.isArray(newArgs)) {
        return newArgs;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapModule(id.split(".")[0], error);
    }
  }

  return args;
}

export function __getBuiltinModuleWithoutPatching(id: string) {
  return getBuiltinModuleWithoutPatching(id);
}
