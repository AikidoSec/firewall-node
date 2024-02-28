import { WrappableSubject } from "./WrappableSubject";
import { WrappableFile } from "./WrappableFile";

export class VersionedPackage {
  private subjects: WrappableSubject[] = [];
  private files: WrappableFile[] = [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  file(relativePath: string): WrappableFile {
    const file = new WrappableFile(relativePath);
    this.files.push(file);

    return file;
  }

  getSubject(selector: (exports: any) => unknown): WrappableSubject {
    const fn = new WrappableSubject(selector);
    this.subjects.push(fn);

    return fn;
  }

  getSubjects() {
    return this.subjects;
  }

  getFiles() {
    return this.files;
  }
}
