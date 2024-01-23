import { CreateServer } from "./integrations/CreateServer";
import { MongoDB } from "./integrations/MongoDB";

export function start() {
  const integrations = [new CreateServer(), new MongoDB()];

  integrations.forEach((integration) => integration.setup());
}
