import { Aikido } from "./Aikido";
import { CreateServer } from "./integrations/CreateServer";
import { MongoDB } from "./integrations/MongoDB";
import * as shimmer from "shimmer";

export function start() {
  shimmer({ logger: () => {} });
  const aikido = new Aikido();
  const integrations = [new CreateServer(), new MongoDB(aikido)];
  integrations.forEach((integration) => integration.setup());
}
