import type { Context } from "../Context";

export class ContextStack {
  constructor(private readonly stack: Context[]) {}

  push(context: Context) {
    this.stack.push(context);
  }

  pop() {
    if (this.stack.length === 0) {
      throw new Error("No context to pop");
    }

    this.stack.pop();
  }

  getCurrent() {
    return this.stack[this.stack.length - 1];
  }
}
