import { getInstance } from "../../AgentSingleton";
import { getBuiltinCallbacks, getPackageCallbacks } from "./instructions";

export function __instrumentInspectArgs(
  id: string,
  isBuiltin: boolean,
  args: unknown[]
): void {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  if (isBuiltin) {
    const callbacks = getBuiltinCallbacks(id);

    if (typeof callbacks.inspectArgs === "function") {
      // Todo support subject?
      callbacks.inspectArgs(args, agent, undefined);
    }

    return;
  }

  const cbFuncs = getPackageCallbacks(id);

  if (typeof cbFuncs.inspectArgs === "function") {
    // Todo support subject?
    cbFuncs.inspectArgs(args, agent, undefined);
  }
}
