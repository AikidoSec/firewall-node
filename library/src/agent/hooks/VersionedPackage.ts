import { Subject } from "./Subject";
import { File } from "./File";

export class VersionedPackage {
  private subjects: Subject[] = [];
  private files: File[] = [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  file(relativePath: string): File {
    const file = new File(relativePath);
    this.files.push(file);

    return file;
  }

  getSubject(selector: (exports: any) => unknown): Subject {
    const fn = new Subject(selector);
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
