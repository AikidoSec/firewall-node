export type OutboundRequestInfo = {
  url: URL;
  port: number;
  method: string;
};

type HookName = "beforeOutboundRequest";

// Map hook names to argument types
interface HookTypes {
  beforeOutboundRequest: {
    args: [data: OutboundRequestInfo];
  };
}

const hooks = new Map<
  HookName,
  Set<(...args: HookTypes[HookName]["args"]) => void | Promise<void>>
>();

export function addHook<N extends HookName>(
  name: N,
  fn: (...args: HookTypes[N]["args"]) => void | Promise<void>
) {
  if (!hooks.has(name)) {
    hooks.set(name, new Set([fn]));
  } else {
    hooks.get(name)!.add(fn);
  }
}

export function removeHook<N extends HookName>(
  name: N,
  fn: (...args: HookTypes[N]["args"]) => void | Promise<void>
) {
  hooks.get(name)?.delete(fn);
}

export function executeHooks<N extends HookName>(
  name: N,
  ...args: [...HookTypes[N]["args"]]
): void {
  const hookSet = hooks.get(name);

  for (const fn of hookSet ?? []) {
    try {
      const result = (
        fn as (...args: HookTypes[N]["args"]) => void | Promise<void>
      )(...args);
      // If it returns a promise, catch any errors but don't wait
      if (result instanceof Promise) {
        result.catch(() => {
          // Silently ignore errors from user hooks
        });
      }
    } catch {
      // Silently ignore errors from user hooks
    }
  }
}
