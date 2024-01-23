import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Aikido } from "../Aikido";
import { getContext } from "../requestContext";
import { Integration } from "./Integration";

export class MongoDB implements Integration {
  constructor(private readonly aikido: Aikido) {}

  setup(): void {
    const aikido = this.aikido;

    new Hook(["mongodb"], (exports) => {
      wrap(exports.Collection.prototype, "find", function (original) {
        return function () {
          const context = getContext();

          if (!context) {
            return original.apply(this, arguments);
          }

          /*console.log(arguments);
          aikido.report({
            message: `Blocked SQL injection for MongoDB.find`,
            context: context,
            stack: new Error().stack || "",
            metadata: {
              collection: "posts",
            },
          });*/

          return original.apply(this, arguments);
        };
      });

      return exports;
    });
  }
}
