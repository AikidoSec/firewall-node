import { WrappableSubject } from "./WrappableSubject";
import { WrappableFile } from "./WrappableFile";
import {
  ModifyingRequireInterceptor,
  ModifyingRequireInterceptorFunction,
} from "./ModifyingRequireInterceptor";
import { addRequireInterceptor } from "../wrapRequire";

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

  wrapRequire(interceptor: ModifyingRequireInterceptorFunction) {
    const require = new ModifyingRequireInterceptor(
      this.packageName,
      interceptor
    );
    addRequireInterceptor(require);
  }

  getSubjects() {
    return this.subjects;
  }

  getFiles() {
    return this.files;
  }
}
