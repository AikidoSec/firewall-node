import { fill } from "../wrap";
import { Module } from "./module";

export class MongoDB implements Module {
  setup(): void {
    const module = require("mongodb");

    fill(module.Collection.prototype, "find", (original) => {
      return function (this: unknown, ...args: unknown[]) {
        console.log("find", args);
        return original.apply(this, args);
      };
    });
  }
}
