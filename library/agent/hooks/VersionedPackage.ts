import type {
  PackageFileInstrumentationInstruction,
  PackageFunctionInstrumentationInstruction,
} from "./instrumentation/types";
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

  /**
   * Register instrumentation instructions for one or multiple functions in one file.
   * The path is relative to the package root.
   */
  addFileInstrumentation(instruction: PackageFileInstrumentationInstruction) {
    if (instruction.path.length === 0) {
      throw new Error("Path must not be empty");
    }

    if (instruction.path.startsWith("/")) {
      throw new Error("Absolute paths are not allowed");
    }

    if (instruction.path.includes("..")) {
      throw new Error("Relative paths with '..' are not allowed");
    }

    if (instruction.path.startsWith("./")) {
      instruction.path = instruction.path.slice(2);
    }

    this.fileInstrumentationInstructions.push(instruction);

    return this;
  }

  /**
   * Register instrumentation instructions for one or multiple functions in multiple similar files.
   * The paths are relative to the package root.
   */
  addMultiFileInstrumentation(
    paths: string[] | string,
    functions: PackageFunctionInstrumentationInstruction[]
  ) {
    if (!Array.isArray(paths)) {
      paths = [paths];
    }
    for (const path of paths) {
      this.addFileInstrumentation({
        path,
        functions,
      });
    }

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
