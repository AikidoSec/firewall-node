import { AsyncLocalStorage } from "async_hooks";
import { Context } from "../Context";

export const ContextStorage = new AsyncLocalStorage<Context>();
