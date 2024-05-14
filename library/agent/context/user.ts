import { getInstance } from "../AgentSingleton";
import { User } from "./ContextStack";
import { ContextStackStorage } from "./ContextStackStorage";

export function setUser(user: User) {
  if (!user.id) {
    return;
  }

  const stack = ContextStackStorage.getStore();

  if (!stack) {
    return;
  }

  stack.setUser(user);

  const agent = getInstance();

  if (agent) {
    const ipAddress = stack.getCurrent().remoteAddress;

    agent.getUsers().addUser({
      id: user.id,
      name: user.name,
      lastIpAddress: ipAddress,
    });
  }
}

export function getUser() {
  const stack = ContextStackStorage.getStore();

  if (!stack) {
    return undefined;
  }

  return stack.getUser();
}
