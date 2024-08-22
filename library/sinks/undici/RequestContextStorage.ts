import { AsyncLocalStorage } from "async_hooks";
import { Context } from "../../agent/Context";

/**
 * This storage is used to store the port of outgoing fetch / undici requests.
 * This is used to check if ports match when we are inspecting the result of dns resolution.
 * If the port does not match, it would be a false positive ssrf detection.
 */
export const RequestContextStorage = new AsyncLocalStorage<{
  url: URL;
  port?: number;
  isFetch?: boolean; // True if the request is a fetch request, false if it's an direct undici request
  inContext?: Context; // Incoming request context
}>();
