import { AsyncLocalStorage } from "node:async_hooks";
import { Aikido } from "./Aikido";

export type RequestContext = {
  aikido: Aikido;
  request: {
    url: URL;
    method: string;
    remoteAddress: string | undefined;
    body: unknown; // Can be an object, string or undefined (the body is parsed by something like body-parser)
  };
};

const requestContext = new AsyncLocalStorage<RequestContext>();

export function getContext() {
  return requestContext.getStore();
}

export function runWithContext<T>(context: RequestContext, fn: () => T) {
  return requestContext.run(context, fn);
}
