import { getInstance } from "../../AgentSingleton";
import { getPackageCallbacks } from "./instructions";

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
    // Todo
    return;
  }

  const cbFuncs = getPackageCallbacks(id);

  if (typeof cbFuncs.inspectArgs === "function") {
    // Todo support subject?
    cbFuncs.inspectArgs(args, agent, undefined);
  }
}
