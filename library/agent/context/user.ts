/* eslint-disable max-lines-per-function */
import { isPlainObject } from "../../helpers/isPlainObject";
import { getInstance } from "../AgentSingleton";
import type { User } from "../Context";
import { ContextStorage } from "./ContextStorage";

export function setUser(
  u: { id: string | number; name?: string } | undefined | null
) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = ContextStorage.getStore();
  if (!context) {
    logWarningSetUserCalledWithoutContext();
    return;
  }

  const user = u as unknown;

  if (user === null || user === undefined) {
    context.user = undefined;
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

  if (context.executedMiddleware) {
    logWarningSetUserCalledAfterMiddleware();
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

function logWarningSetUserCalledAfterMiddleware() {
  if (loggedWarningSetUserCalledAfterMiddleware) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `setUser(...) must be called before the Zen middleware is executed.`
  );

  loggedWarningSetUserCalledAfterMiddleware = true;
}

let loggedWarningSetUserCalledWithoutContext = false;

function logWarningSetUserCalledWithoutContext() {
  if (loggedWarningSetUserCalledWithoutContext) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `setUser(...) did not find a context. Make sure to call setUser(...) within a handler or middleware of a supported framework.`
  );

  loggedWarningSetUserCalledWithoutContext = true;
}
