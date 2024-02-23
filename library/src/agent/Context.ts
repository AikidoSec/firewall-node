import { AsyncLocalStorage } from "async_hooks";
import type { ParsedQs } from "qs";

/**
 * @prop url This is the URL where the (express) request came in
 * @prop method This is the HTTP Method used for the (express) request
 * @prop query These are the URL Query parameters (e.g. example.com?param1=value1)
 * @prop headers The HTTP headers accompanying the request
 * @prop remoteAddress The remote address of the end-user
 * @prop body This is the (form) body that possible accompanies the request
 * @prop cookies These are the cookies accompanying the request
 * @interface
 */
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

/**
 * This function gives you the {@link Context} stored in asynchronous local storage
 * @returns the stored context in asynchronous local storage
 */
export function getContext() {
  return requestContext.getStore();
}

/**
 *
 * @param context The context you want to set ({@link Context})
 * @param fn
 * @returns
 */
export function runWithContext<T>(context: Context, fn: () => T) {
  return requestContext.run(context, fn);
}
