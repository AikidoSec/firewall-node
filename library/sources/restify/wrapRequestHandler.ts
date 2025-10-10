import { runWithContext } from "../../agent/Context";
import { contextFromRequest, type RestifyRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: Function): Function {
  // Restify v9 and higher is checking that the request handler or middleware has the correct signature.
  // oxlint-disable-next-line no-unused-vars
  return function wrapped(req: RestifyRequest, res: any, next: any) {
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    });
  };
}
