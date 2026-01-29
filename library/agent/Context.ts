import type { ParsedQs } from "qs";
import { extractStringsFromUserInput } from "../helpers/extractStringsFromUserInput";
import { ContextStorage } from "./context/ContextStorage";
import { AsyncResource } from "async_hooks";
import type { Endpoint } from "./Config";
import { Source, SOURCES } from "./Source";

export type User = { id: string; name?: string };

export type Context = {
  url: string | undefined; // Full URL including protocol and host, if available
  urlPath?: string | undefined; // The path part of the URL (e.g. /api/user)
  method: string | undefined;
  query: ParsedQs;
  headers: Record<string, string | string[] | undefined>;
  routeParams: Record<string, string> | undefined;
  remoteAddress: string | undefined;
  body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  cookies: Record<string, string>;
  attackDetected?: boolean;
  blockedDueToIPOrBot?: boolean;
  consumedRateLimit?: boolean;
  user?: User;
  source: string;
  route: string | undefined;
  graphql?: string[];
  xml?: unknown[];
  rawBody?: unknown;
  subdomains?: string[]; // https://expressjs.com/en/5x/api.html#req.subdomains
  markUnsafe?: unknown[];
  cache?: ReturnType<typeof extractStringsFromUserInput>;
  cachePathTraversal?: ReturnType<typeof extractStringsFromUserInput>;
  /**
   * Used to store redirects in outgoing http(s) requests that are started by a user-supplied input (hostname and port / url) to prevent SSRF redirect attacks.
   */
  outgoingRequestRedirects?: { source: URL; destination: URL }[];
  executedMiddleware?: boolean;
  rateLimitGroup?: string; // Used to apply rate limits to a group of users
  rateLimitedEndpoint?: Endpoint; // The route that was rate limited
};

/**
 * Get the current request context that is being handled
 *
 * We don't want to allow the user to modify the context directly, so we use `Readonly<Context>`
 */
export function getContext(): Readonly<Context> | undefined {
  return ContextStorage.getStore();
}

function isSourceKey(key: string): key is Source {
  return SOURCES.includes(key as Source);
}

// We need to use a function to mutate the context because we need to clear the cache when the user input changes
export function updateContext<K extends keyof Context>(
  context: Context,
  key: K,
  value: Context[K]
) {
  context[key] = value;

  if (isSourceKey(key)) {
    // Clear all the cached user input strings
    // Only if user input related fields are updated
    delete context.cache;
    delete context.cachePathTraversal;
  }
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
    current.urlPath = context.urlPath;
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
    current.rawBody = context.rawBody;
    current.subdomains = context.subdomains;
    current.outgoingRequestRedirects = context.outgoingRequestRedirects;
    current.markUnsafe = context.markUnsafe;

    // Clear all the cached user input strings
    delete current.cache;

    return fn();
  }

  // Cleanup lingering cache
  // In tests the context is often passed by reference
  // Make sure to clean up the cache before running the function
  delete context.cache;
  delete context.cachePathTraversal;

  // If there's no context yet, we create a new context and run the function with it
  return ContextStorage.run(context, fn);
}

/**
 * Binds the given function to the current execution context.
 * This fixes the issue that context is not available in event handlers that are called outside of runWithContext
 * Static method AsyncLocalStorage.bind(fn) was added in Node.js v19.8.0 and v18.16.0, so we can't use it yet, but it does the same thing.
 * Also done by OpenTelemetry: https://github.com/open-telemetry/opentelemetry-js/blob/a6020fb113a60ae6abc1aa925fa6744880e7fa15/api/src/api/context.ts#L86
 */
export function bindContext<T>(fn: () => T) {
  return AsyncResource.bind(fn);
}
