export type OutboundRequestInfo = {
  url: URL;
  port: number;
  method: string;
};

type OutboundRequestCallback = (
  request: OutboundRequestInfo
) => void | Promise<void>;

const outboundRequestCallbacks = new Set<OutboundRequestCallback>();

export function onOutboundRequest(callback: OutboundRequestCallback): void {
  if (typeof callback !== "function") {
    throw new TypeError("Callback must be a function");
  }

  outboundRequestCallbacks.add(callback);
}

export function triggerOutboundRequestHooks(
  request: OutboundRequestInfo
): void {
  if (outboundRequestCallbacks.size === 0) {
    return;
  }

  outboundRequestCallbacks.forEach((callback) => {
    try {
      const result = callback(request);
      // If it returns a promise, catch any errors but don't wait
      if (result instanceof Promise) {
        result.catch(() => {
          // Silently ignore errors from user hooks
        });
      }
    } catch {
      // Silently ignore errors from user hooks
    }
  });
}
