const MAX_BODY_SIZE_MB = 20;

export function getMaxBodySize() {
  if (process.env.AIKIDO_MAX_BODY_SIZE_MB) {
    const parsed = parseInt(process.env.AIKIDO_MAX_BODY_SIZE_MB, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 1024 * 1024;
    }
  }

  return MAX_BODY_SIZE_MB * 1024 * 1024;
}
