import { AsyncLocalStorage } from "node:async_hooks";
import { Aikido } from "./Aikido";
import type { ParsedQs } from "qs";

export type Request = {
  url: string | undefined;
  method: string;
  query: ParsedQs;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress: string | undefined;
  body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  cookies: Record<string, string>;
};

export type RequestContext = {
  aikido: Aikido;
  request: Request;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext() {
  return requestContext.getStore();
}

export function runWithContext<T>(context: RequestContext, fn: () => T) {
  return requestContext.run(context, fn);
}
