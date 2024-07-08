import { WrappableSubject } from "./WrappableSubject";
import { WrappableFile } from "./WrappableFile";
import { WrappableRequireSubject } from "./WrappableRequireSubject";

export class VersionedPackage {
  private subjects: WrappableSubject[] = [];
  private requireSubject: WrappableRequireSubject | null = null;
  private files: WrappableFile[] = [];

  constructor(private readonly range: string) {
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
    this.requireSubject = new WrappableRequireSubject();
    return this.requireSubject;
  }

  getSubjects() {
    return this.subjects;
  }

  getRequireSubject() {
    return this.requireSubject;
  }

  getFiles() {
    return this.files;
  }
}
