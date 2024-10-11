import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import type { ReportingAPI } from "../agent/api/ReportingAPI";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import type { Token } from "../agent/api/Token";
import type { Logger } from "../agent/logger/Logger";
import { LoggerNoop } from "../agent/logger/LoggerNoop";

/**
 * Create a test agent for testing purposes
 */
export function createTestAgent(opts?: {
  block?: boolean;
  logger?: Logger;
  api?: ReportingAPI;
  token?: Token;
  serverless?: string;
}) {
  const agent = new Agent(
    opts?.block ?? true,
    opts?.logger ?? new LoggerNoop(),
    opts?.api ?? new ReportingAPIForTesting(),
    opts?.token, // Defaults to undefined
    opts?.serverless // Defaults to undefined
  );

  setInstance(agent);

  return agent;
}
