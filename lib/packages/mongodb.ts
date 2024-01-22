import { moduleExists } from "../moduleExists";
import { fill } from "../fill";
import { asyncLocalStorage } from "./express";
import { Package } from "./package";

export class MongoDB implements Package {
  patch(): void {
    if (!moduleExists("mongodb")) {
      return;
    }

    const module = require("mongodb");

    fill(module.Collection.prototype, "find", (original) => {
      return function (this: unknown, ...args: unknown[]) {
        const { request, response, id } = asyncLocalStorage.getStore();
        console.log("find", args, request.url, id);
        response.send("NOOOO");

        return original.apply(this, args);
      };
    });
  }
}
