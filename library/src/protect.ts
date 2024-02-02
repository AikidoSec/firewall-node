// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyHandler } from "aws-lambda";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { API, APIFetch, APIThrottled, Token } from "./API";
import { Express } from "./integrations/Express";
import { Integration } from "./integrations/Integration";
import { createLambdaWrapper } from "./Lambda";
import { MongoDB } from "./integrations/MongoDB";
import * as shimmer from "shimmer";
import { Logger, LoggerConsole, LoggerNoop } from "./Logger";

function commonIntegrations() {
  return [new MongoDB()];
}

type Options = {
  debug?: boolean;
};

const defaultOptions: Options = {
  debug: false,
};

function getLogger(options: Options): Logger {
  if (options.debug) {
    return new LoggerConsole();
  }

  return new LoggerNoop();
}

function getAPI(): API {
  if (process.env.AIKIDO_URL) {
    return new APIThrottled(new APIFetch(new URL(process.env.AIKIDO_URL)));
  }

  return new APIThrottled(
    new APIFetch(new URL("https://aikido.dev/api/runtime/events"))
  );
}

function getTokenFromEnv(): Token | undefined {
  return process.env.AIKIDO_TOKEN
    ? new Token(process.env.AIKIDO_TOKEN)
    : undefined;
}

function getAgent(options: Options, integrations: Integration[]) {
  const current = getInstance();

  if (current) {
    return current;
  }

  const token = getTokenFromEnv();
  const logger = getLogger(options);
  const api = getAPI();
  const agent = new Agent(logger, api, token, integrations);
  setInstance(agent);

  return agent;
}

export function protect(options?: Options) {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  options = { ...defaultOptions, ...options };
  const agent = getAgent(options, [...commonIntegrations(), new Express()]);
  agent.start();
}

export function lambda(
  options?: Options
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  return (handler) => {
    // Disable shimmer logging
    shimmer({ logger: () => {} });

    options = { ...defaultOptions, ...options };
    const agent = getAgent(options, [...commonIntegrations()]);
    agent.start();

    return createLambdaWrapper(agent, handler);
  };
}
