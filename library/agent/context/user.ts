import { getInstance } from "../AgentSingleton";
import type { User } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function setUser(user: User) {
  if (!user.id) {
    return;
  }

  const context = ContextStorage.getStore();

  if (!context) {
    return;
  }

  context.user = user;
  const agent = getInstance();

  if (agent) {
    const ipAddress = context.remoteAddress;

    agent.getUsers().addUser({
      id: user.id,
      name: user.name,
      lastIpAddress: ipAddress,
    });
  }
}
