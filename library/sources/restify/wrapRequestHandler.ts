import { runWithContext } from "../../agent/Context";
import { contextFromRequest, type RestifyRequest } from "./contextFromRequest";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

export function wrapRequestHandler(handler: Function): Function {
  // Restify v9 and higher is checking that the request handler or middleware has the correct signature.
  return function wrapped(req: RestifyRequest, _res: any, _next: any) {
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      if (!_res.headersSent && shouldBlockRequestForPayloadDepth()) {
        _res.status(413);
        _res.setHeader("Content-Type", "text/plain");
        _res.send(PAYLOAD_TOO_DEEP_MESSAGE);
        return _next(false);
      }

      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        arguments
      );
    });
  };
}
