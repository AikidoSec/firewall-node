const MAX_BODY_SIZE_IN_BYTES = 1024 * 1024 * 20; // 20 MB

export function getMaxBodySize() {
  if (process.env.AIKIDO_MAX_BODY_SIZE) {
    const parsed = parseInt(process.env.AIKIDO_MAX_BODY_SIZE, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return MAX_BODY_SIZE_IN_BYTES;
}
