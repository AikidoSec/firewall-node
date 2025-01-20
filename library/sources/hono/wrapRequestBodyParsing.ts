import type { Context } from "hono";
import { getContext, updateContext } from "../../agent/Context";

export function wrapRequestBodyParsing(req: Context["req"]) {
  req.parseBody = wrapRequestHandler(req.parseBody);
  req.json = wrapRequestHandler(req.json);
  req.text = wrapRequestHandler(req.text);
}

type BodyParseFunctions =
  | Context["req"]["parseBody"]
  | Context["req"]["json"]
  | Context["req"]["text"];

function wrapRequestHandler<T extends BodyParseFunctions>(handler: T): T {
  return async function parse() {
    // @ts-expect-error No type for arguments
    // eslint-disable-next-line prefer-rest-params
    const returnValue = await handler.apply(this, arguments);

    if (returnValue) {
      const context = getContext();
      if (context) {
        updateContext(context, "body", returnValue);
      }
    }

    return returnValue as ReturnType<T>;
  } as T;
}
