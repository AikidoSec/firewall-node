import { getInstance } from "../AgentSingleton";
import { updateContext } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function markUnsafe(payload: unknown) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = ContextStorage.getStore();

  if (!context) {
    return;
  }

  const current = context.markUnsafe || [];

  const a = JSON.stringify(payload);

  if (
    !current.some((item) => {
      // JSON.stringify is used to compare objects
      // without having to copy a deep equality function
      return JSON.stringify(item) === a;
    })
  ) {
    current.push(payload);
    updateContext(context, "markUnsafe", current);
  }
}
