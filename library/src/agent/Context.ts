import { AsyncLocalStorage } from "async_hooks";
import type { ParsedQs } from "qs";

export type Context = {
  url: string | undefined;
  method: string;
  query: ParsedQs;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress: string | undefined;
  body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  cookies: Record<string, string>;
  attackDetected?: boolean;
};

const requestContext = new AsyncLocalStorage<Context>();

/**
 * Get the current request context that is being handled
 */
export function getContext() {
  return requestContext.getStore();
}

/**
 * Executes a function with a given request context
 *
 * The code executed inside the function will have access to the context using {@link getContext}
 *
 * This is needed because Node.js is single-threaded, so we can't use a global variable to store the context.
 */
export function runWithContext<T>(context: Context, fn: () => T) {
  return requestContext.run(context, fn);
}
