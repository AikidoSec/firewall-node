import { Agent } from "../agent/Agent";
import { isFeatureEnabled } from "../helpers/featureFlags";
import { resolveBinaryPath } from "./binary";
import { AiCoreServer } from "./coreServer";
import { ProxySupervisor } from "./supervisor";

/**
 * Starts the AI proxy if AIKIDO_FEATURE_AI_PROXY is set and a proxy binary
 * can be found (AIKIDO_AI_PROXY_BIN); no-op otherwise. Wires the in-process
 * AiCoreServer (rules down, events up via agent.reportEvent) to a
 * ProxySupervisor that spawns and restarts the Rust binary.
 */
export function maybeStartAiProxy(agent: Agent, token: string): void {
  if (!isFeatureEnabled("ai_proxy") || !token) {
    return;
  }

  const binaryPath = resolveBinaryPath();
  if (!binaryPath) {
    return;
  }

  const coreServer = new AiCoreServer(
    () => ({ aiEnabled: true, blockedAiTools: [] }),
    // The proxy's wire payload isn't statically typed (it's JSON parsed from
    // an HTTP body); reportEvent's union describes the shape it's expected
    // to have.
    (event) => agent.reportEvent(event as Parameters<Agent["reportEvent"]>[0])
  );

  coreServer
    .start()
    .then(() => {
      const supervisor = new ProxySupervisor(token, coreServer.url, binaryPath);
      supervisor.start();
    })
    .catch(() => {
      // AI proxy visibility is best-effort; never let its startup break the app.
    });
}
