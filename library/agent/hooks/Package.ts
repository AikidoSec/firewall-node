import { VersionedPackage } from "./VersionedPackage";

type PackageName = string;

/**
 * Represents an installed package that can have multiple versions.
 *
 * When the package is required, you can wrap methods from the exports objects.
 *
 * Not to be used for built-in node modules.
 */
export class Package {
  private versions: VersionedPackage[] = [];

  constructor(private packageName: PackageName) {
    if (!this.packageName) {
      throw new Error("Package name is required");
    }
  }

  getName() {
    return this.packageName;
  }

  setName(name: string) {
    this.packageName = name;
  }

  withVersion(range: string): VersionedPackage {
    const pkg = new VersionedPackage(range);
    this.versions.push(pkg);

    return pkg;
  }

  getVersions() {
    return this.versions;
  }
}
