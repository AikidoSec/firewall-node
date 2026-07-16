import { runWithContext } from "../../agent/Context";
import { contextFromRequest, type RestifyRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: Function): Function {
  // Restify v9 and higher is checking that the request handler or middleware has the correct signature.
  return function wrapped(req: RestifyRequest, _res: any, _next: any) {
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
