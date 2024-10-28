/**
 * Implementation based on https://github.com/jshttp/cookie
 * License: MIT
 * Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
 * Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>
 */

/**
 * Decodes the URI provided to it
 * @param str encoded URI
 * @returns decoded URI
 */
function decode(str: string): string {
  return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
}
/**
 * Encapsulates the "decode" function with a try-catch.
 * @param str string that needs to be decoded
 * @returns Returns the decoded result or the same string if decode fails
 */
function tryDecode(str: string): string {
  try {
    return decode(str);
  } catch {
    return str;
  }
}

/**
 * This function parses a cookie string and returns an object
 * @param str A string containing cookies
 * @returns Object with the cookie name as a key and their value as a value
 * @example
 * parse("foo=oof;bar=rab"); // Returns {foo: "oof", bar: "rab"}
 */
export function parse(str: string) {
  const obj: Record<string, string> = {};

  const len = str.length;
  // RFC 6265 sec 4.1.1, RFC 2616 2.2 defines a cookie name consists of one char minimum, plus '='.
  if (len < 2) {
    return obj;
  }

  let index = 0;
  do {
    const eqIdx = str.indexOf("=", index);

    // no more cookie pairs
    if (eqIdx === -1) {
      break;
    }

    let endIdx = str.indexOf(";", index);

    if (endIdx === -1) {
      endIdx = len;
    } else if (eqIdx > endIdx) {
      // backtrack on prior semicolon
      index = str.lastIndexOf(";", eqIdx - 1) + 1;
      continue;
    }

    const keyStartIdx = startIndex(str, index, eqIdx);
    const keyEndIdx = endIndex(str, eqIdx, keyStartIdx);
    const key = str.slice(keyStartIdx, keyEndIdx);

    // only assign once
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      let valStartIdx = startIndex(str, eqIdx + 1, endIdx);
      let valEndIdx = endIndex(str, endIdx, valStartIdx);

      if (
        str.charCodeAt(valStartIdx) === 0x22 /* " */ &&
        str.charCodeAt(valEndIdx - 1) === 0x22 /* " */
      ) {
        valStartIdx++;
        valEndIdx--;
      }

      const val = str.slice(valStartIdx, valEndIdx);

      obj[key] = tryDecode(val);
    }

    index = endIdx + 1;
  } while (index < len);

  return obj;
}

function startIndex(str: string, index: number, max: number): number {
  do {
    const code = str.charCodeAt(index);
    if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) return index;
  } while (++index < max);
  return max;
}

function endIndex(str: string, index: number, min: number): number {
  while (index > min) {
    const code = str.charCodeAt(--index);
    if (code !== 0x20 /*   */ && code !== 0x09 /* \t */) return index + 1;
  }
  return min;
}
