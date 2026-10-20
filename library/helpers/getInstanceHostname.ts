import { hostname } from "os";

export function getInstanceHostname(): string {
  const instanceName = process.env.AIKIDO_INSTANCE_NAME;
  if (instanceName && instanceName.trim().length > 0) {
    return instanceName.trim();
  }

  return hostname() || "";
}
