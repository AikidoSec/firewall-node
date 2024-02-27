import { Package } from "./Package";

export class Hooks {
  private readonly packages: Package[] = [];

  package(packageName: string): Package {
    if (!packageName) {
      throw new Error("Package name is required");
    }

    const pkg = new Package(packageName);
    this.packages.push(pkg);

    return pkg;
  }

  getPackages() {
    return this.packages;
  }
}
