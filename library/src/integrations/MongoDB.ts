import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getContext } from "../requestContext";
import { Integration } from "./Integration";
import type { Collection } from "mongodb";

export class MongoDB implements Integration {
  setup(): void {
    new Hook(["mongodb"], (exports, name, basedir) => {
      wrap<typeof Collection, "find">(
        exports.Collection.prototype,
        "find",
        function (original) {
          return function () {
            const context = getContext();
            console.log("find", arguments, context);
            return original.apply(this, arguments);
          };
        }
      );

      return exports;
    });
  }
}
