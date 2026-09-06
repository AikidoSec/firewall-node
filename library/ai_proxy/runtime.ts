import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Discovery file the supervisor publishes once the AI proxy is up, and the
 * fetch override reads to find it. A deterministic path (not passed via a
 * callback) because SDK clients are often constructed at import time, before
 * the proxy has necessarily started.
 */
export type RuntimeInfo = {
  proxyPort: number;
  caPath: string;
  pid: number;
};

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getRuntimeFile(token: string): string {
  return join(tmpdir(), `aikido_ai_proxy_${tokenHash(token)}.json`);
}

export function writeRuntimeInfo(token: string, info: RuntimeInfo) {
  const path = getRuntimeFile(token);
  const tmpPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(info), { mode: 0o600 });
  renameSync(tmpPath, path);
}

export function clearRuntimeInfo(token: string) {
  try {
    unlinkSync(getRuntimeFile(token));
  } catch {
    // already gone
  }
}

export function readRuntimeInfo(token: string): RuntimeInfo | undefined {
  const path = getRuntimeFile(token);
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (
      typeof data?.proxyPort !== "number" ||
      typeof data?.caPath !== "string" ||
      !existsSync(data.caPath)
    ) {
      return undefined;
    }
    return data;
  } catch {
    return undefined;
  }
}
