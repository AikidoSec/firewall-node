import { BuiltinInstrumentationInstruction } from "./instrumentation/types";
import { RequireInterceptor } from "./RequireInterceptor";

export class BuiltinModule {
  private requireInterceptors: RequireInterceptor[] = [];
  private instrumentationInstructions: BuiltinInstrumentationInstruction[] = [];

  constructor(private readonly name: string) {
    if (!this.name) {
      throw new Error("Name is required");
    }
  }

  getName() {
    return this.name;
  }

  onRequire(interceptor: RequireInterceptor) {
    this.requireInterceptors.push(interceptor);
  }

  getRequireInterceptors() {
    return this.requireInterceptors;
  }

  addInstrumentation(instruction: BuiltinInstrumentationInstruction) {
    this.instrumentationInstructions.push(instruction);
  }

  getInstrumentationInstructions() {
    return this.instrumentationInstructions;
  }
}
