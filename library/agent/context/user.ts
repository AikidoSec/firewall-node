/* eslint-disable max-lines-per-function */
import { isPlainObject } from "../../helpers/isPlainObject";
import type { Agent } from "../Agent";
import { getInstance } from "../AgentSingleton";
import type { User } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function setUser(u: { id: string | number; name?: string }) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const user = u as unknown;

  if (user === null || user === undefined) {
    agent
      .getLogger()
      .error(`setUser(...) can not be called with null or undefined.`);
    return;
  }

  if (!isPlainObject(user)) {
    agent
      .getLogger()
      .error(
        `setUser(...) expects an object with 'id' and 'name' properties, found ${typeof user} instead.`
      );
    return;
  }

  if (!("id" in user)) {
    agent
      .getLogger()
      .error(`setUser(...) expects an object with 'id' property.`);
    return;
  }

  if (typeof user.id !== "string" && typeof user.id !== "number") {
    agent
      .getLogger()
      .error(
        `setUser(...) expects an object with 'id' property of type string or number, found ${typeof user.id} instead.`
      );
    return;
  }

  if (typeof user.id === "string" && user.id.length === 0) {
    agent
      .getLogger()
      .error(
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

  if (context.executedMiddleware) {
    logWarningSetUserCalledAfterMiddleware(agent);
  }

  context.user = validatedUser;

  const ipAddress = context.remoteAddress;

  agent.getUsers().addUser({
    id: validatedUser.id,
    name: validatedUser.name,
    lastIpAddress: ipAddress,
  });
}

let loggedWarningSetUserCalledAfterMiddleware = false;

function logWarningSetUserCalledAfterMiddleware(agent: Agent) {
  if (loggedWarningSetUserCalledAfterMiddleware) {
    return;
  }

  agent
    .getLogger()
    .warn(`setUser(...) must be called before the Zen middleware is executed.`);

  loggedWarningSetUserCalledAfterMiddleware = true;
}
