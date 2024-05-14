import type { Context } from "../Context";

export class ContextStack {
  private readonly stack: Context[];

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
}
