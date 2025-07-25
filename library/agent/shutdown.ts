import { getInstance } from "./AgentSingleton";

export async function shutdown() {
  await getInstance()?.shutdown();
}
