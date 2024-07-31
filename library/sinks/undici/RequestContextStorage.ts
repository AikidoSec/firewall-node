import { AsyncLocalStorage } from "async_hooks";

/**
 * This storage is used to store the port of outgoing fetch / undici requests.
 * This is used to check if ports match when we are inspecting the result of dns resolution.
 * If the port does not match, it would be a false positive ssrf detection.
 */
export const RequestContextStorage = new AsyncLocalStorage<{
  hostname: string;
  port?: number;
  redirected?: boolean;
}>();
