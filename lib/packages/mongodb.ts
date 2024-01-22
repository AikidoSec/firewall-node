import { moduleExists } from "../moduleExists";
import { fill } from "../fill";
import { asyncLocalStorage } from "./http";
import { Package } from "./package";

export class MongoDB implements Package {
  patch(): void {
    if (!moduleExists("mongodb")) {
      return;
    }

    const module = require("mongodb");

    fill(module.Collection.prototype, "find", (original) => {
      return function (this: unknown, ...args: unknown[]) {
        const context = asyncLocalStorage.getStore();

        if (!context) {
          return original.apply(this, args);
        }

        const { request, response, id } = context;
        console.log("find", args, request.url);

        return original.apply(this, args);
      };
    });
  }
}
