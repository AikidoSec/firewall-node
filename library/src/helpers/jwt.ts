/**
 * The JWT module only exports one function : tryDecodeAsJWT
 * @module helpers/JWT
 */

/**
 * This function tries to decode your input as if it is a JSON Web Token, if it fails to do so it returns {jwt: false}.
 * @param jwt A (possible) JWT
 * @returns The JWT if it's valid, otherwise it returns false
 * @example
 * tryDecodeAsJWT("invalid"); // Returns {jwt: false}
 */
export function tryDecodeAsJWT(
  jwt: string
): { jwt: true; object: unknown } | { jwt: false } {
  if (!jwt.includes(".")) {
    return { jwt: false };
  }

  const parts = jwt.split(".");

  if (parts.length !== 3) {
    return { jwt: false };
  }

  try {
    return {
      jwt: true,
      object: JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")),
    };
  } catch (e) {
    return {
      jwt: false,
    };
  }
}
