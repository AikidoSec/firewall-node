import { PackageFileInstrumentationInstruction } from "./instrumentation/types";
import { RequireInterceptor } from "./RequireInterceptor";

export class VersionedPackage {
  private requireInterceptors: RequireInterceptor[] = [];
  private requireFileInterceptors = new Map<string, RequireInterceptor>();
  private fileInstrumentationInstructions: PackageFileInstrumentationInstruction[] =
    [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  onRequire(interceptor: RequireInterceptor) {
    if (typeof interceptor !== "function") {
      throw new Error("Interceptor must be a function");
    }

    this.requireInterceptors.push(interceptor);

    return this;
  }

  onFileRequire(relativePath: string, interceptor: RequireInterceptor) {
    if (relativePath.length === 0) {
      throw new Error("Relative path must not be empty");
    }

    if (this.requireFileInterceptors.has(relativePath)) {
      throw new Error(`Interceptor for ${relativePath} already exists`);
    }

    if (relativePath.startsWith("/")) {
      throw new Error(
        "Absolute paths are not allowed for require file interceptors"
      );
    }

    if (relativePath.includes("..")) {
      throw new Error(
        "Relative paths with '..' are not allowed for require file interceptors"
      );
    }

    if (relativePath.startsWith("./")) {
      relativePath = relativePath.slice(2);
    }

    this.requireFileInterceptors.set(relativePath, interceptor);

    return this;
  }

  addFileInstrumentation(instruction: PackageFileInstrumentationInstruction) {
    this.fileInstrumentationInstructions.push(instruction);

    return this;
  }

  getRequireInterceptors() {
    return this.requireInterceptors;
  }

  getRequireFileInterceptor(relativePath: string) {
    return this.requireFileInterceptors.get(relativePath);
  }

  getFileInstrumentationInstructions() {
    return this.fileInstrumentationInstructions;
  }
}
