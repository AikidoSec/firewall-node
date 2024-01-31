// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyHandler } from "aws-lambda";
import { Aikido } from "./Aikido";
import { API, APIFetch, Token } from "./API";
import { Express } from "./integrations/Express";
import { Integration } from "./integrations/Integration";
import { createLambdaWrapper } from "./integrations/Lambda";
import { MongoDB } from "./integrations/MongoDB";
import * as shimmer from "shimmer";
import { Logger, LoggerConsole, LoggerNoop } from "./Logger";

function commonIntegrations(aikido: Aikido) {
  return [new MongoDB()];
}

function setupIntegrations(aikido: Aikido, integrations: Integration[]) {
  integrations.forEach((integration) => integration.setup());
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
    return new APIFetch(new URL(process.env.AIKIDO_URL));
  }

  return new APIFetch(new URL("https://aikido.dev/api/runtime/events"));
}

function getTokenFromEnv(): Token | undefined {
  return process.env.AIKIDO_TOKEN
    ? new Token(process.env.AIKIDO_TOKEN)
    : undefined;
}

export function protect(options?: Options) {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  options = { ...defaultOptions, ...options };
  const token = getTokenFromEnv();
  const logger = getLogger(options);
  const api = getAPI();
  const aikido = new Aikido(logger, api, token);

  setupIntegrations(aikido, [
    ...commonIntegrations(aikido),
    new Express(aikido),
  ]);
}

export function lambda(
  options?: Options
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  return (handler) => {
    // Disable shimmer logging
    shimmer({ logger: () => {} });

    options = { ...defaultOptions, ...options };
    const token = getTokenFromEnv();
    const logger = getLogger(options);
    const api = getAPI();
    const aikido = new Aikido(logger, api, token);

    setupIntegrations(aikido, [...commonIntegrations(aikido)]);

    return createLambdaWrapper(aikido, handler);
  };
}
