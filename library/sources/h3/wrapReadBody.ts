import { getContext, updateContext } from "../../agent/Context";
import { formDataToPlainObject } from "../../helpers/formDataToPlainObject";

export async function wrapReadBody(_args: unknown[], returnValue: unknown) {
  const context = getContext();

  if (!context) {
    return returnValue;
  }

  const body = await returnValue;
  if (body) {
    if (body instanceof FormData) {
      updateContext(context, "body", formDataToPlainObject(body));
    } else {
      updateContext(context, "body", body);
    }
  }

  return body;
}
