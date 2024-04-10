import { WrappableSubject } from "./WrappableSubject";

/*
 * We want to be notified whenever a new instance of S3 is created
 *
 * const AWS = require("aws-sdk");
 * new AWS.S3();
 */
export class ConstructorInterceptor {
  private readonly subjects: WrappableSubject[] = [];

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
