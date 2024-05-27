const MAX_BODY_SIZE_IN_BYTES = 20 * 1024 * 1024; // 20 MB

export function getMaxBodySize() {
  if (process.env.AIKIDO_MAX_BODY_SIZE) {
    let maxBodySize = process.env.AIKIDO_MAX_BODY_SIZE;

    // Remove the "m" suffix if it exists
    if (maxBodySize.toLowerCase().endsWith("m")) {
      maxBodySize = maxBodySize.slice(0, -1);
    }

    const parsed = parseInt(maxBodySize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 1024 * 1024;
    }
  }

  return MAX_BODY_SIZE_IN_BYTES;
}
