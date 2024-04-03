export function limitLengthMetadata(
  metadata: Record<string, string>,
  maxLength: number
) {
  for (const key in metadata) {
    if (metadata[key].length > maxLength) {
      metadata[key] = metadata[key].substring(0, maxLength);
    }
  }

  return metadata;
}
