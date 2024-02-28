import { Subject } from "./Subject";

export class File {
  private subjects: Subject[] = [];

  constructor(private readonly relativePath: string) {
    if (!this.relativePath) {
      throw new Error("Relative path is required");
    }
  }

  getRelativePath() {
    return this.relativePath;
  }

  subject(selector: (exports: any) => unknown): Subject {
    const fn = new Subject(selector);
    this.subjects.push(fn);

    return fn;
  }

  getSubjects() {
    return this.subjects;
  }
}
