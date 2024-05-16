import { AsyncLocalStorage } from "node:async_hooks";
import { Context } from "../Context";

export const ContextStorage = new AsyncLocalStorage<Context>();
