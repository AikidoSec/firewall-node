// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyHandler } from "aws-lambda";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { API, APIFetch, APIThrottled, Token } from "./API";
import { IDGeneratorULID } from "./IDGenerator";
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
  debug: boolean;
  block: boolean;
};

const defaultOptions: Options = {
  debug: false,
  block: true,
};

function getLogger(options: Options): Logger {
  if (options.debug) {
    return new LoggerConsole();
  }

  return new LoggerNoop();
}

function throttle(api: API) {
  return new APIThrottled(api, {
    maxEventsPerInterval: 200,
    intervalInMs: 60 * 60 * 1000,
  });
}

function getAPI(): API {
  if (process.env.AIKIDO_URL) {
    return throttle(new APIFetch(new URL(process.env.AIKIDO_URL)));
  }

  return throttle(
    new APIFetch(new URL("https://aikido.dev/api/runtime/events"))
  );
}

function getTokenFromEnv(): Token | undefined {
  return process.env.AIKIDO_TOKEN
    ? new Token(process.env.AIKIDO_TOKEN)
    : undefined;
}

function dryModeEnabled(): boolean {
  return (
    process.env.AIKIDO_NO_BLOCKING === "true" ||
    process.env.AIKIDO_NO_BLOCKING === "1"
  );
}

function getAgent(options: Options, integrations: Integration[]) {
  const current = getInstance();

  if (current) {
    return current;
  }

  const token = getTokenFromEnv();
  const logger = getLogger(options);
  const api = getAPI();
  const agent = new Agent(
    options.block,
    logger,
    api,
    token,
    integrations,
    new IDGeneratorULID()
  );

  setInstance(agent);

  return agent;
}

function getOptions(partialOptions?: Partial<Options>): Options {
  const options = { ...defaultOptions, ...partialOptions };

  if (dryModeEnabled()) {
    options.block = false;
  }

  return options;
}

export function protect(options?: Partial<Options>) {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  const agent = getAgent(getOptions(options), [
    ...commonIntegrations(),
    new Express(),
  ]);
  agent.start();
}

export function lambda(
  options?: Partial<Options>
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  return (handler) => {
    // Disable shimmer logging
    shimmer({ logger: () => {} });

    const agent = getAgent(getOptions(options), [...commonIntegrations()]);
    agent.start();

    return createLambdaWrapper(agent, handler);
  };
}
