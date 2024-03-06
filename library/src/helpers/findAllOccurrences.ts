export function findAllOccurrences(
  haystack: string,
  needle: string
): [number, number][] {
  if (haystack.length === 0 || needle.length === 0) {
    return [];
  }

  const occurrences: [number, number][] = [];

  let index = 0;
  while (index < haystack.length) {
    const foundIndex = haystack.indexOf(needle, index);
    if (foundIndex === -1) {
      break;
    }

    occurrences.push([foundIndex, foundIndex + needle.length - 1]);
    index = foundIndex + 1;
  }

  return occurrences;
}
