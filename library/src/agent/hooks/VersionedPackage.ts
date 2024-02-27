import { Selector } from "./Selector";

export class VersionedPackage {
  private selectors: Selector[] = [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  subject(selector: (exports: any) => unknown): Selector {
    const fn = new Selector(selector);
    this.selectors.push(fn);

    return fn;
  }

  getSelectors() {
    return this.selectors;
  }
}
