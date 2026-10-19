import { getContext, updateContext } from "../../agent/Context";
import { formDataToPlainObject } from "../../helpers/formDataToPlainObject";
import { isPlainObject } from "../../helpers/isPlainObject";

type MultipartPart = { name?: string; data: Buffer };

export async function wrapReadBody(_args: unknown[], returnValue: unknown) {
  const context = getContext();

  if (!context) {
    return returnValue;
  }

  const body = returnValue instanceof Promise ? await returnValue : returnValue;
  if (body) {
    updateContext(context, "body", toInspectableBody(body));
  }

  return body;
}

// Zen only extracts strings, it ignores Buffers
function toInspectableBody(body: unknown): unknown {
  if (body instanceof FormData) {
    return formDataToPlainObject(body);
  }

  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }

  if (isMultipartParts(body)) {
    return multipartPartsToPlainObject(body);
  }

  return body;
}

function isMultipartParts(body: unknown): body is MultipartPart[] {
  return (
    Array.isArray(body) &&
    body.length > 0 &&
    body.every((part) => isPlainObject(part) && Buffer.isBuffer(part.data))
  );
}

// Parts with a filename are included, a client could add one to a text field to hide its value
function multipartPartsToPlainObject(parts: MultipartPart[]) {
  const formData = new FormData();
  for (const part of parts) {
    if (part.name) {
      formData.append(part.name, part.data.toString("utf8"));
    }
  }

  return formDataToPlainObject(formData);
}
