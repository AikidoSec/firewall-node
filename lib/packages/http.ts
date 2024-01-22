import type { RequestListener, IncomingMessage, ServerResponse } from "http";
import { fill } from "../fill";
import { Package } from "./package";
const { AsyncLocalStorage } = require("node:async_hooks");

export const asyncLocalStorage = new AsyncLocalStorage();

export class Http implements Package {
  patch() {
    // TODO: Patch HTTPS module
    const module = require("http");

    fill(module, "createServer", (original) => {
      return function (this: unknown, ...args: unknown[]) {
        const app = args[0] as RequestListener<IncomingMessage, ServerResponse>;

        return original.apply(this, [
          (request, response) => {
            asyncLocalStorage.run({ request, response }, () => {
              app(request, response);
            });
          },
        ]);
      };
    });
  }
}
