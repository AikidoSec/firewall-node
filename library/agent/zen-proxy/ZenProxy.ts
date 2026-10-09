/* oxlint-disable no-console */
import { spawn, type ChildProcess } from "child_process";
import { accessSync, constants } from "fs";
import * as http from "http";
import * as https from "https";
import { join } from "path";
import * as tls from "tls";
import { colorText } from "../../helpers/colorText";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryParseURL } from "../../helpers/tryParseURL";
import { warnBox } from "../../helpers/warnBox";
import type { AIStatistics } from "../AIStatistics";
import type { Logger } from "../logger/Logger";

type ProxyDispatcher = {
  dispatch(opts: unknown, handler: unknown): boolean;
  close(): Promise<void>;
};

type ReadyProxy = {
  isZenProxyHost: (hostname: string) => boolean;
  dispatcher: ProxyDispatcher;
  httpsAgent: https.Agent;
};

type SetGlobalProxyFromEnv = (env: Record<string, string>) => () => void;

export function getZenProxyBinaryPath(): string {
  // Relative to the library so that it works from both library/ and build/
  return join(
    __dirname,
    "..",
    "..",
    "internals",
    `zen-proxy-${process.platform}-${process.arch}`
  );
}

// `*` matches exactly one DNS label, e.g. bedrock-runtime.*.amazonaws.com
export function createZenProxyHostMatcher(
  hosts: string[]
): (hostname: string) => boolean {
  const exact = new Set<string>();
  const wildcards: string[][] = [];
  for (const host of hosts) {
    if (host.includes("*")) {
      wildcards.push(host.split("."));
    } else {
      exact.add(host);
    }
  }

  return (hostname) => {
    if (exact.has(hostname)) {
      return true;
    }

    if (wildcards.length === 0) {
      return false;
    }

    const labels = hostname.split(".");

    return wildcards.some(
      (pattern) =>
        pattern.length === labels.length &&
        pattern.every((label, i) =>
          label === "*" ? labels[i] !== "" : label === labels[i]
        )
    );
  };
}

// Node.js only warns when NODE_EXTRA_CA_CERTS cannot be read, the proxy would exit
function isReadableFile(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

// Node.js does not export undici's EnvHttpProxyAgent, we briefly install it as global dispatcher to grab its class
function getEnvHttpProxyAgentClass(): new (
  options: Record<string, unknown>
) => ProxyDispatcher {
  const setGlobalProxyFromEnv = (
    http as unknown as { setGlobalProxyFromEnv: SetGlobalProxyFromEnv }
  ).setGlobalProxyFromEnv;
  const restore = setGlobalProxyFromEnv({ https_proxy: "http://127.0.0.1:9" });
  try {
    const global = globalThis as Record<symbol, { constructor: unknown }>;
    const dispatcher =
      global[Symbol.for("undici.globalDispatcher.2")] ||
      global[Symbol.for("undici.globalDispatcher.1")];

    return dispatcher.constructor as new (
      options: Record<string, unknown>
    ) => ProxyDispatcher;
  } finally {
    restore();
  }
}

function toTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export class ZenProxy {
  private child: ChildProcess | undefined = undefined;
  private ready: ReadyProxy | undefined = undefined;

  constructor(
    private readonly logger: Logger,
    private readonly aiStatistics: AIStatistics
  ) {}

  /**
   * Throws when the Zen proxy cannot run here, so that the app does not start without it
   */
  start(serverless: boolean, extraArgs: string[] = []) {
    if (serverless) {
      throw new Error(
        "AIKIDO: The Zen proxy (AIKIDO_FEATURE_ZEN_PROXY) is not supported in serverless environments."
      );
    }

    if (
      typeof (http as { setGlobalProxyFromEnv?: unknown })
        .setGlobalProxyFromEnv !== "function"
    ) {
      throw new Error(
        `AIKIDO: The Zen proxy (AIKIDO_FEATURE_ZEN_PROXY) requires Node.js v24.14.0 or newer, current version is ${process.version}.`
      );
    }

    // NODE_USE_ENV_PROXY / --use-env-proxy: fetch and https.request already go through the app's egress proxy and would never be routed
    if (https.globalAgent.options.proxyEnv !== undefined) {
      throw new Error(
        "AIKIDO: The Zen proxy (AIKIDO_FEATURE_ZEN_PROXY) is not supported with NODE_USE_ENV_PROXY."
      );
    }

    const bin = getZenProxyBinaryPath();
    try {
      accessSync(bin, constants.X_OK);
    } catch {
      throw new Error(
        `AIKIDO: The Zen proxy (AIKIDO_FEATURE_ZEN_PROXY) is not available for ${process.platform}-${process.arch}: ${bin} is missing or not executable.`
      );
    }

    // Egress with TLS inspection: the app trusts that CA via NODE_EXTRA_CA_CERTS, the proxy must trust it too
    const extraCA = process.env.NODE_EXTRA_CA_CERTS;
    const args =
      extraCA && isReadableFile(extraCA)
        ? ["--upstream-ca", extraCA, ...extraArgs]
        : extraArgs;

    const child = spawn(bin, args, {
      env: {},
      // The proxy exits when stdin closes, so it dies together with the app
      stdio: ["pipe", "pipe", "ignore"],
    });
    this.child = child;

    child.on("error", (error) => this.onStopped(child, error.message));
    child.on("exit", (code, signal) =>
      this.onStopped(child, signal ? `signal ${signal}` : `exit code ${code}`)
    );
    child.stdin?.on("error", () => {});
    child.stdout?.setEncoding("utf8");

    let buffered = "";
    child.stdout?.on("data", (chunk: string) => {
      buffered += chunk;
      let newline: number;
      while ((newline = buffered.indexOf("\n")) !== -1) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        this.handleLine(line);
      }
    });

    child.unref();
    (child.stdin as unknown as { unref?: () => void } | null)?.unref?.();
    (child.stdout as unknown as { unref?: () => void } | null)?.unref?.();
  }

  /**
   * True while LLM calls are routed through the proxy (SDK sinks should not record them)
   */
  isEnabled(): boolean {
    return this.ready !== undefined;
  }

  shouldProxy(origin: string | URL | undefined): boolean {
    if (!this.ready || !origin) {
      return false;
    }

    const url = typeof origin === "string" ? tryParseURL(origin) : origin;

    return (
      url !== undefined &&
      url.protocol === "https:" &&
      (url.port === "" || url.port === "443") &&
      this.ready.isZenProxyHost(url.hostname)
    );
  }

  getFetchDispatcher(): ProxyDispatcher | undefined {
    return this.ready?.dispatcher;
  }

  getHttpsAgent(): https.Agent | undefined {
    return this.ready?.httpsAgent;
  }

  private onStopped(child: ChildProcess, reason: string) {
    // "error" and "exit" can both fire for the same child
    if (this.child !== child) {
      return;
    }

    this.child = undefined;
    const ready = this.ready;
    this.ready = undefined;

    if (ready) {
      ready.httpsAgent.destroy();
      ready.dispatcher.close().catch(() => {});
    }

    console.warn(
      colorText(
        "red",
        warnBox(
          `The Zen proxy stopped (${reason}). LLM calls are no longer inspected by the Zen proxy and go directly to the provider.`
        )
      )
    );
  }

  handleLine(line: string) {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (!isPlainObject(message)) {
      return;
    }

    try {
      if (message.type === "ready") {
        this.onReady(message);
      } else if (message.type === "ai_call") {
        this.onAICall(message);
      }
    } catch (error) {
      this.logger.log(
        `Failed to handle Zen proxy message: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private onReady(message: Record<string, unknown>) {
    const { port, username, password, ca, hosts } = message;

    if (
      typeof port !== "number" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof ca !== "string" ||
      !Array.isArray(hosts) ||
      !hosts.every((host) => typeof host === "string")
    ) {
      this.logger.log("Zen proxy sent an invalid ready message");
      return;
    }

    const proxyUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@127.0.0.1:${port}`;
    const trustedCAs = [...tls.getCACertificates("default"), ca];
    const ProxyAgent = getEnvHttpProxyAgentClass();

    this.ready = {
      isZenProxyHost: createZenProxyHostMatcher(hosts),
      dispatcher: new ProxyAgent({
        httpsProxy: proxyUrl,
        noProxy: "",
        requestTls: { ca: trustedCAs },
      }),
      httpsAgent: new https.Agent({
        keepAlive: true,
        proxyEnv: { HTTPS_PROXY: proxyUrl },
        ca: trustedCAs,
      }),
    };
    this.logger.log(`Zen proxy is ready on port ${port}`);
  }

  private onAICall(message: Record<string, unknown>) {
    if (
      typeof message.provider !== "string" ||
      typeof message.model !== "string"
    ) {
      return;
    }

    this.aiStatistics.onAICall({
      provider: message.provider,
      model: message.model,
      inputTokens: toTokenCount(message.input_tokens),
      outputTokens: toTokenCount(message.output_tokens),
      cacheReadTokens: toTokenCount(message.cache_read_tokens),
      cacheWriteTokens: toTokenCount(message.cache_write_tokens),
      toolsCalled: Array.isArray(message.tools_called)
        ? message.tools_called.filter(
            (name): name is string => typeof name === "string"
          )
        : [],
    });
  }
}
