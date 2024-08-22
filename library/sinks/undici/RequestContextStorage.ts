import { AsyncLocalStorage } from "async_hooks";
import { Context } from "../../agent/Context";

export type UndiciRequestContext = {
  url: URL;
  port?: number;
  isFetch?: boolean; // True if the request is a fetch request, false if it's an direct undici request
  inContext?: Context; // Incoming request context
};

/**
 * This storage is used to store the port of outgoing fetch / undici requests.
 * This is used to check if ports match when we are inspecting the result of dns resolution.
 * If the port does not match, it would be a false positive ssrf detection.
 *
 * Its also used to store the incoming context of a request, if the request is a redirect.
 */
const RequestContextStorage = new AsyncLocalStorage<UndiciRequestContext>();

/**
 * Run a function with the given undici request context.
 * If the context is already set, the context is updated with the new values.
 */
export function runWithUndiciRequestContext<T>(
  context: UndiciRequestContext,
  fn: () => T
): T {
  const current = RequestContextStorage.getStore();

  if (current) {
    current.url = context.url;
    current.port = context.port;
    current.isFetch = context.isFetch;
    current.inContext = context.inContext;

    return fn();
  }

  return RequestContextStorage.run(context, fn);
}

/**
 * Get the current undici request context (outgoing request).
 */
export function getUndiciRequestContext(): UndiciRequestContext | undefined {
  return RequestContextStorage.getStore();
}
