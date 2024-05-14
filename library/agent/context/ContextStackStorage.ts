import { AsyncLocalStorage } from "async_hooks";
import { ContextStack } from "./ContextStack";

export const ContextStackStorage = new AsyncLocalStorage<ContextStack>();
