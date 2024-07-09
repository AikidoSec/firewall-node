import { Patcher } from "./Patching";
import { WrappableSubject } from "./WrappableSubject";
import { WrappableFile } from "./WrappableFile";

export type Patch = (exports: unknown, patcher: Patcher) => unknown;

export class VersionedPackage {
  private subjects: WrappableSubject[] = [];
  private files: WrappableFile[] = [];
  private whenInstalledPatcher: Patch | undefined = undefined;

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  patchWhenInstalled(fn: Patch) {
    if (this.whenInstalledPatcher) {
      throw new Error("When installed patcher already set");
    }

    this.whenInstalledPatcher = fn;

    return this;
  }

  getWhenInstalledPatcher() {
    return this.whenInstalledPatcher;
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

  getSubjects() {
    return this.subjects;
  }

  getFiles() {
    return this.files;
  }
}
