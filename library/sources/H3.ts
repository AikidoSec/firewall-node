import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapEventHandler } from "./h3/wrapEventHandler";
import type {
  EventHandlerRequest,
  EventHandler,
  EventHandlerResponse,
} from "h3";

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

    if (typeof args[0] !== "function") {
      // Todo support object
      return args;
    }

    return [
      wrapEventHandler(
        args[0] as EventHandler<EventHandlerRequest, EventHandlerResponse>,
        h3
      ),
    ];
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
      });
  }
}
