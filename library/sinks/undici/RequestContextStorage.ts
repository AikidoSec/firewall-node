import { AsyncLocalStorage } from "async_hooks";

export const RequestContextStorage = new AsyncLocalStorage<{
  port: number | undefined;
}>();
