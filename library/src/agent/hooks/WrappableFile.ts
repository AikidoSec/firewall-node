import { WrappableSubject } from "./WrappableSubject";

/**
 * Normally we use require-in-the-middle to wrap the exports of a package.
 *
 * However, sometimes the export don't contain the subjects that we need to wrap.
 *
 * In that case, we can require the library file directly and wrap the exports of the file.
 *
 * Using require-in-the-middle is preferred because we don't have to require any files until the package is actually used.
 */
export class WrappableFile {
  private subjects: WrappableSubject[] = [];

  constructor(private readonly relativePath: string) {
    if (!this.relativePath) {
      throw new Error("Relative path is required");
    }
  }

  getRelativePath() {
    return this.relativePath;
  }

  addSubject(selector: (exports: any) => unknown): WrappableSubject {
    const fn = new WrappableSubject(selector);
    this.subjects.push(fn);

    return fn;
  }

  getSubjects() {
    return this.subjects;
  }
}
