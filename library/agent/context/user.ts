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
}

export function getUser() {
  const stack = ContextStackStorage.getStore();

  if (!stack) {
    return undefined;
  }

  return stack.getUser();
}
