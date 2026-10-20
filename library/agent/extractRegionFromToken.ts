export function extractRegionFromToken(token: string): string {
  if (!token || !token.startsWith("AIK_RUNTIME_")) {
    return "EU";
  }

  const tokenWithoutPrefix = token.replace("AIK_RUNTIME_", "");
  const parts = tokenWithoutPrefix.split("_");

  // New format: AIK_RUNTIME_{sys_group_id}_{service_id}_{region}_{random}
  // Old format: AIK_RUNTIME_{sys_group_id}_{service_id}_{random}
  if (parts.length === 4) {
    return parts[2];
  }

  return "EU";
}
