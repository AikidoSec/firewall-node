import { AsyncLocalStorage } from "node:async_hooks";
import type { ParsedQs } from "qs";

export type Context = {
  url: string | undefined;
  method: string;
  query: ParsedQs;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress: string | undefined;
  body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  cookies: Record<string, string>;
};

const requestContext = new AsyncLocalStorage<Context>();

export function getContext() {
  return requestContext.getStore();
}

export function runWithContext<T>(context: Context, fn: () => T) {
  return requestContext.run(context, fn);
}
