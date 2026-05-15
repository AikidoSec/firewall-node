import { getInstance } from "./AgentSingleton";

export async function shutdown(timeoutInMS?: number): Promise<void> {
  await getInstance()?.shutdown(timeoutInMS);
}
