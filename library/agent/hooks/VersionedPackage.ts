import { WrappableSubject } from "./WrappableSubject";
import { WrappableFile } from "./WrappableFile";
import {
  ModifyingRequireInterceptor,
  ModifyingRequireInterceptorFunction,
} from "./ModifyingRequireInterceptor";
import { addRequireInterceptor } from "../wrapRequire";
import { WrappableRequireSubject } from "./WrappableRequireSubject";

export class VersionedPackage {
  private subjects: WrappableSubject[] = [];
  private files: WrappableFile[] = [];

  constructor(
    private readonly packageName: string,
    private readonly range: string
  ) {
    if (!this.packageName) {
      throw new Error("Package name is required");
    }
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  addFile(relativePath: string): WrappableFile {
    const file = new WrappableFile(relativePath);
    this.files.push(file);

    return file;
  }

  addSubject(selector: (exports: any) => unknown): WrappableSubject {
    const fn = new WrappableSubject(selector);
    this.subjects.push(fn);

    return fn;
  }

  /**
   * Wraps the require function for this package.
   * Only required if root export of module is a function.
   * Use addSubject to wrap other exports.
   */
  addRequireSubject() {
    const require = new WrappableRequireSubject(this.packageName);
    return require;
  }

  getSubjects() {
    return this.subjects;
  }

  getFiles() {
    return this.files;
  }
}
