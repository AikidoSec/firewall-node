import { getInstance } from "./AgentSingleton";

export async function shutdown(): Promise<void> {
  await getInstance()?.shutdown();
}
