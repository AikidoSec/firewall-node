import { normalizeLikeURLConstructor } from "./normalizeLikeURLConstructor";

const dangerousPathParts = ["../", "..\\"];

export function containsUnsafePathParts(filePath: string) {
  for (const dangerousPart of dangerousPathParts) {
    if (filePath.includes(dangerousPart)) {
      return true;
    }
  }

  return false;
}

export function containsUnsafePathPartsUrl(filePath: string) {
  return containsUnsafePathParts(normalizeLikeURLConstructor(filePath));
}
