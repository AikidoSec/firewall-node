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
}
