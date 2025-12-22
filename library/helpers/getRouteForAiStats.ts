import { getContext } from "../agent/Context";

export function getRouteForAiStats() {
  const context = getContext();

  if (context && context.route && context.method) {
    return { path: context.route, method: context.method };
  }

  return undefined;
}
