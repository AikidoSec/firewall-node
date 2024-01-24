import { Aikido } from "./Aikido";
import { Express } from "./integrations/Express";
import { MongoDB } from "./integrations/MongoDB";
import * as shimmer from "shimmer";

export function start() {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  const aikido = new Aikido();
  const integrations = [new MongoDB(), new Express(aikido)];

  integrations.forEach((integration) => integration.setup());
}
