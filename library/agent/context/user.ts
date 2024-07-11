import { isPlainObject } from "../../helpers/isPlainObject";
import { getInstance } from "../AgentSingleton";
import type { User } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function setUser(user: unknown) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  if (!isPlainObject(user)) {
    agent.log(
      `setUser(...) expects an object with 'id' and 'name' properties, found ${typeof user} instead.`
    );
    return;
  }

  if (!("id" in user)) {
    agent.log(`setUser(...) expects an object with 'id' property.`);
    return;
  }

  if (typeof user.id !== "string" && typeof user.id !== "number") {
    agent.log(
      `setUser(...) expects an object with 'id' property of type string or number, found ${typeof user.id} instead.`
    );
    return;
  }

  if (typeof user.id === "string" && user.id.length === 0) {
    agent.log(
      `setUser(...) expects an object with 'id' property non-empty string.`
    );
    return;
  }

  const validatedUser: User = { id: user.id.toString() };

  if (typeof user.name === "string" && user.name.length > 0) {
    validatedUser.name = user.name;
  }

  const context = ContextStorage.getStore();

  if (!context) {
    return;
  }

  context.user = validatedUser;

  const ipAddress = context.remoteAddress;

  agent.getUsers().addUser({
    id: validatedUser.id,
    name: validatedUser.name,
    lastIpAddress: ipAddress,
  });
}
