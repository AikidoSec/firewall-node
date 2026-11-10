/*
 * Largely based on parseHeaders function from nodejs/unici
 * MIT License
 * Copyright (c) Matteo Collina and Undici contributors
 * https://github.com/nodejs/undici
 */

import { createSafeObject } from "../../helpers/createSafeObject";

export function parseHeaders(
  headers:
    | (string | Buffer | Buffer[])[]
    | Record<string, string | string[] | Buffer | Buffer[] | undefined>,
  obj?: Record<string, string | string[]>
) {
  if (obj === undefined) {
    obj = createSafeObject({}) as Record<string, string | string[]>;
  }

  if (!Array.isArray(headers)) {
    for (const [name, value] of Object.entries(headers ?? {})) {
      if (value === undefined) {
        continue;
      }
      obj[name.toLowerCase()] = Array.isArray(value)
        ? value.map((v) => v.toString("utf8"))
        : value.toString("utf8");
    }
    return obj;
  }

  for (let i = 0; i < headers.length; i += 2) {
    const key = headerNameToString(headers[i]);
    let val = obj[key];

    if (val) {
      if (typeof val === "string") {
        val = [val];
        obj[key] = val;
      }
      val.push(headers[i + 1].toString("utf8"));
    } else {
      const headersValue = headers[i + 1];
      if (typeof headersValue === "string") {
        obj[key] = headersValue;
      } else {
        obj[key] = Array.isArray(headersValue)
          ? headersValue.map((x) => x.toString("utf8"))
          : headersValue.toString("utf8");
      }
    }
  }

  // See https://github.com/nodejs/node/pull/46528
  if ("content-length" in obj && "content-disposition" in obj) {
    obj["content-disposition"] = Buffer.from(
      // @ts-expect-error Ignore
      obj["content-disposition"]
    ).toString("latin1");
  }

  return obj;
}

function headerNameToString(value: string | Buffer | Buffer[]) {
  return typeof value === "string"
    ? value.toLowerCase()
    : value.toString("latin1").toLowerCase();
}
