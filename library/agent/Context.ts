import type { ParsedQs } from "qs";
import { ContextStorage } from "./context/ContextStorage";

export type User = { id: string; name?: string };

export type Context = {
  url: string | undefined;
  method: string | undefined;
  query: ParsedQs;
  headers: Record<string, string | string[] | undefined>;
  routeParams: Record<string, string> | undefined;
  remoteAddress: string | undefined;
  body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  cookies: Record<string, string>;
  attackDetected?: boolean;
  consumedRateLimitForIP?: boolean;
  consumedRateLimitForUser?: boolean;
  user?: { id: string; name?: string };
  source: string;
  route: string | undefined;
  graphql?: string[];
  xml?: unknown;
  subdomains?: string[]; // https://expressjs.com/en/5x/api.html#req.subdomains
};

/**
 * Get the current request context that is being handled
 */
export function getContext() {
  return ContextStorage.getStore();
}

/**
 * Executes a function with a given request context
 *
 * The code executed inside the function will have access to the context using {@link getContext}
 *
 * This is needed because Node.js is single-threaded, so we can't use a global variable to store the context.
 */
export function runWithContext<T>(context: Context, fn: () => T) {
  const current = ContextStorage.getStore();

  // If there is already a context, we just update it
  // In this way we don't lose the `attackDetected` flag
  if (current) {
    current.url = context.url;
    current.method = context.method;
    current.query = context.query;
    current.headers = context.headers;
    current.routeParams = context.routeParams;
    current.remoteAddress = context.remoteAddress;
    current.body = context.body;
    current.cookies = context.cookies;
    current.source = context.source;
    current.route = context.route;
    current.graphql = context.graphql;
    current.xml = context.xml;
    current.subdomains = context.subdomains;

    return fn();
  }

  // If there's no context yet, we create a new context and run the function with it
  return ContextStorage.run(context, fn);
}
