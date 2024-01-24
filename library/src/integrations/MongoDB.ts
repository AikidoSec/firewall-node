import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getContext } from "../requestContext";
import { Integration } from "./Integration";

export class MongoDB implements Integration {
  setup(): void {
    new Hook(["mongodb"], (exports) => {
      wrap(exports.Collection.prototype, "find", function (original) {
        return function () {
          const context = getContext();

          if (!context) {
            return original.apply(this, arguments);
          }

          /*context.aikido.report({
            message: `Blocked SQL injection for MongoDB.find()`,
            context: context,
            stack: new Error().stack || "",
            metadata: {
              // TODO: Add collection etc
            },
          });*/

          return original.apply(this, arguments);
        };
      });

      return exports;
    });
  }
}
