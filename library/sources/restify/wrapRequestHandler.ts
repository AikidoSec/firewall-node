/* eslint-disable prefer-rest-params */
import { runWithContext } from "../../agent/Context";
import { contextFromRequest, RestifyRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: Function): Function {
  return function wrapped() {
    if (arguments.length === 0) {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this
      );
    }

    const req: RestifyRequest = arguments[0];
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        arguments
      );
    });
  };
}
