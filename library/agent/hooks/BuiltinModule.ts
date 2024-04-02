import { WrappableSubject } from "./WrappableSubject";

export class BuiltinModule {
  private subjects: WrappableSubject[] = [];

  constructor(private readonly name: string) {
    if (!this.name) {
      throw new Error("Name is required");
    }
  }

  getName() {
    return this.name;
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
