import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapEventHandler } from "./h3/wrapEventHandler";
import type {
  EventHandlerRequest,
  EventHandler,
  EventHandlerResponse,
} from "h3";
import { wrapReadBody } from "./h3/wrapReadBody";

/**
 * Todos:
 *
 * createApp:
 *  onRequest
 *  onBeforeResponse
 *  onAfterResponse
 *
 * Body parsing
 * defineLazyEventHandler
 *
 * ...
 */

export class H3 implements Wrapper {
  private wrapEventHandler(args: unknown[], h3: typeof import("h3")) {
    if (args.length !== 1) {
      return args;
    }

    if (typeof args[0] === "function") {
      return [
        wrapEventHandler(
          args[0] as EventHandler<EventHandlerRequest, EventHandlerResponse>,
          h3
        ),
      ];
    }

    if (
      args[0] &&
      typeof args[0] === "object" &&
      !Array.isArray(args[0]) &&
      "handler" in args[0] &&
      typeof args[0].handler === "function"
    ) {
      args[0].handler = wrapEventHandler(
        args[0].handler as EventHandler<
          EventHandlerRequest,
          EventHandlerResponse
        >,
        h3
      );
    }

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("h3")
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports, "defineEventHandler", pkgInfo, {
          modifyArgs: (args) => {
            return this.wrapEventHandler(args, exports);
          },
        });
        const bodyFuncs = [
          "readBody",
          "readFormData",
          "readMultipartFormData",
          "readRawBody",
          "readValidatedBody",
        ];
        for (const func of bodyFuncs) {
          wrapExport(exports, func, pkgInfo, {
            modifyReturnValue: wrapReadBody,
          });
        }
      });
  }
}
