import { ChildProcess, spawn } from "node:child_process";
import {
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo, createServer } from "node:net";
import { clearRuntimeInfo, writeRuntimeInfo } from "./runtime";

const READY_TIMEOUT_MS = 30_000;
const RESTART_BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];
const MIN_STABLE_UPTIME_MS = 5000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitReady(
  metaPort: number,
  proc: ChildProcess
): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      return false;
    }
    try {
      const res = await fetch(`http://127.0.0.1:${metaPort}/ping`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/**
 * Spawns and supervises the zen-ai-proxy child process.
 *
 * The proxy holds no cloud credentials: --aikido-url/--reporting-endpoint
 * both point at the in-process AiCoreServer, never at Aikido's cloud.
 */
export class ProxySupervisor {
  private dataDir: string;
  private proc: ChildProcess | undefined;
  private stopped = false;

  constructor(
    private readonly token: string,
    private readonly coreUrl: string,
    private readonly binaryPath: string,
    // Test-only: chains the proxy's egress through another local proxy
    // instead of the real internet. Never set in production.
    private readonly upstreamProxyUrl?: string
  ) {
    this.dataDir = join(tmpdir(), `aikido_ai_proxy_${process.pid}_data`);
  }

  start() {
    // mkdirSync's mode is masked by umask; chmod explicitly so the token stays unreadable to other users.
    mkdirSync(this.dataDir, { recursive: true });
    chmodSync(this.dataDir, 0o700);
    mkdirSync(join(this.dataDir, "secrets"), { recursive: true });
    chmodSync(join(this.dataDir, "secrets"), 0o700);
    // The proxy refuses to talk to any cloud-backed subsystem without this
    // file, even though we never point it at a real cloud.
    writeFileSync(
      join(this.dataDir, "config.json"),
      JSON.stringify({ token: this.token, device_id: "zen-node-agent" }),
      { mode: 0o600 }
    );

    this.runLoop().catch(() => {
      // runLoop only rejects on a truly unexpected error; supervision itself
      // never throws into the caller.
    });
  }

  stop() {
    this.stopped = true;
    this.proc?.kill("SIGTERM");
    clearRuntimeInfo(this.token);
    rmSync(this.dataDir, { recursive: true, force: true });
  }

  private async runLoop() {
    let backoffIndex = 0;
    while (!this.stopped) {
      const proxyPort = await freePort();
      const metaPort = await freePort();
      const args = [
        "--bind",
        `127.0.0.1:${proxyPort}`,
        "--meta",
        `127.0.0.1:${metaPort}`,
        "--secrets",
        join(this.dataDir, "secrets"),
        "-D",
        this.dataDir,
        "--aikido-url",
        this.coreUrl,
        "--reporting-endpoint",
        this.coreUrl,
      ];
      if (this.upstreamProxyUrl) {
        args.push("--proxy", this.upstreamProxyUrl);
      }

      const logFd = openSync(join(this.dataDir, "proxy.log"), "a");
      const startedAt = Date.now();
      this.proc = spawn(this.binaryPath, args, {
        stdio: ["ignore", logFd, logFd],
        detached: true,
      });
      // The child inherits its own duplicate of the fd on spawn; close the
      // parent's copy so restarts don't leak one descriptor per cycle.
      closeSync(logFd);
      chmodSync(this.binaryPath, 0o755);

      const exited = new Promise<void>((resolve) =>
        this.proc?.once("exit", () => resolve())
      );

      if (await waitReady(metaPort, this.proc)) {
        await this.fetchCaAndPublish(metaPort, proxyPort);
        backoffIndex = 0;
      }

      await exited;
      clearRuntimeInfo(this.token);
      if (this.stopped) {
        return;
      }

      const delay =
        Date.now() - startedAt < MIN_STABLE_UPTIME_MS
          ? RESTART_BACKOFF_MS[
              Math.min(backoffIndex++, RESTART_BACKOFF_MS.length - 1)
            ]
          : RESTART_BACKOFF_MS[(backoffIndex = 0)];
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  private async fetchCaAndPublish(metaPort: number, proxyPort: number) {
    try {
      const res = await fetch(`http://127.0.0.1:${metaPort}/ca`, {
        signal: AbortSignal.timeout(5000),
      });
      const pem = await res.text();
      const caPath = join(this.dataDir, "ca.pem");
      writeFileSync(caPath, pem, { mode: 0o600 });
      writeRuntimeInfo(this.token, {
        proxyPort,
        caPath,
        pid: this.proc?.pid ?? 0,
      });
    } catch {
      // no CA published this cycle; fetch override stays fail-open until the
      // next successful cycle
    }
  }
}
