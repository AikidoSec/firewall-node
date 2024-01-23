import * as http from "http";
import * as https from "https";
import { Hook } from "require-in-the-middle";
import { runWithContext } from "../requestContext";
import { Integration } from "./Integration";
import { wrap } from "shimmer";

type HttpModule = typeof http | typeof https;

export class CreateServer implements Integration {
  setup(): void {
    this.setupHooks("http");
    this.setupHooks("https");
  }

  private setupHooks(module: "http" | "https") {
    new Hook([module], (module) => {
      wrap<HttpModule, "createServer">(
        module as HttpModule,
        "createServer",
        function (original) {
          return function () {
            const originalHandler = arguments[arguments.length - 1];
            arguments[arguments.length - 1] = (request, response) => {
              runWithContext(
                {
                  method: request.method,
                  remoteAddress: request.socket.remoteAddress,
                },
                () => {
                  originalHandler(request, response);
                }
              );
            };

            return original.apply(this, arguments);
          };
        }
      );

      return module;
    });
  }
}
