/* eslint-disable prefer-rest-params */
import { runWithContext } from "../../agent/Context";
import { contextFromRequest, type RestifyRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: Function): Function {
  // Restify v9 and higher is checking that the request handler or middleware has the correct signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function wrapped(req: RestifyRequest, res: any, next: any) {
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
