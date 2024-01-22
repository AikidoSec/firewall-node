import { moduleExists } from "../moduleExists";
import { fill } from "../fill";
import { Package } from "./package";

export class MongoDB implements Package {
  patch(): void {
    if (!moduleExists("mongodb")) {
      return;
    }

    const module = require("mongodb");

    fill(module.Collection.prototype, "find", (original) => {
      return function (this: unknown, ...args: unknown[]) {
        console.log("find", args);
        return original.apply(this, args);
      };
    });
  }
}
