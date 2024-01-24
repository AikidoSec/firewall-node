import { APIGatewayProxyHandler } from "aws-lambda";
import { Aikido } from "./Aikido";
import { Express } from "./integrations/Express";
import { Integration } from "./integrations/Integration";
import { createLambdaWrapper } from "./integrations/Lambda";
import { MongoDB } from "./integrations/MongoDB";
import * as shimmer from "shimmer";

function createCommonIntegrations(aikido: Aikido) {
  return [new MongoDB()];
}

function setupIntegrations(aikido: Aikido, integrations: Integration[]) {
  integrations.forEach((integration) => integration.setup());
}

export function protect() {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  const aikido = new Aikido();

  setupIntegrations(aikido, [
    ...createCommonIntegrations(aikido),
    new Express(aikido),
  ]);
}

export function protectLambda(
  handler: APIGatewayProxyHandler
): APIGatewayProxyHandler {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  const aikido = new Aikido();

  setupIntegrations(aikido, [...createCommonIntegrations(aikido)]);

  return createLambdaWrapper(aikido, handler);
}
