import { AsyncLocalStorage } from "async_hooks";
import type { ParsedQs } from "qs";
import { ContextStack } from "./context/ContextStack";

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
  source: string;
  route: string | undefined;
};

const requestContext = new AsyncLocalStorage<ContextStack>();

/**
 * Get the current request context that is being handled
 */
export function getContext() {
  const stack = requestContext.getStore();

  if (!stack) {
    return undefined;
  }

  return stack.getCurrent();
}

/**
 * Executes a function with a given request context
 *
 * The code executed inside the function will have access to the context using {@link getContext}
 *
 * This is needed because Node.js is single-threaded, so we can't use a global variable to store the context.
 */
export function runWithContext<T>(context: Context, fn: () => T) {
  const stack = requestContext.getStore();

  // If there is already a stack, we just push the context to it
  // Contexts can be nested, so we need to keep track of them
  // e.g. GET /posts/:id
  // app.use("/posts/:postId", (req, res, next) => ...)
  // ^ the code that runs in the middleware will have different route params than the code that runs here:
  // app.get("/posts/:id", (req, res) => ...)
  if (stack) {
    stack.push(context);
    const result = fn();
    stack.pop();

    return result;
  }

  // If there's no stack yet, we create a new stack and run the function with it
  return requestContext.run(new ContextStack(context), fn);
}
