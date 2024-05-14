import type { Context } from "../Context";

export type User = { id: string; name?: string };

export class ContextStack {
  private readonly stack: Context[];
  private user: User | undefined = undefined;

  constructor(readonly parent: Context) {
    this.stack = [parent];
  }

  push(context: Context) {
    this.stack.push(context);
  }

  pop() {
    if (this.stack.length === 1) {
      throw new Error("Cannot pop the last context in the stack");
    }

    this.stack.pop();
  }

  getCurrent() {
    return this.stack[this.stack.length - 1];
  }

  getUser() {
    return this.user;
  }

  setUser(user: User) {
    this.user = user;
  }
}
