import { APIAuthType } from "./getApiAuthType";

/**
 * Merge two APIAuthType arrays into one, without duplicates.
 * Can return undefined if both parameters are not an array.
 */
export function mergeApiAuthTypes(
  existing: APIAuthType[] | undefined,
  newAuth: APIAuthType[] | undefined
): APIAuthType[] | undefined {
  if (!Array.isArray(newAuth) || newAuth.length === 0) {
    return existing;
  }

  if (!Array.isArray(existing) || existing.length === 0) {
    return newAuth;
  }

  const result: APIAuthType[] = [...existing];

  for (const auth of newAuth) {
    if (!result.find((a) => isEqualAPIAuthType(a, auth))) {
      result.push(auth);
    }
  }

  return result;
}

/**
 * Compare two APIAuthType objects for equality.
 */
function isEqualAPIAuthType(a: APIAuthType, b: APIAuthType): boolean {
  return (
    a.type === b.type &&
    a.in === b.in &&
    a.name === b.name &&
    a.scheme === b.scheme
  );
}
