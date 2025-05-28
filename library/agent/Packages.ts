type PackageInfo = {
  name: string;
  version: string;
  requiredAt: number;
};

export class Packages {
  private packages: Map<string, PackageInfo[]> = new Map();

  addPackage(pkg: { name: string; version: string }) {
    const versions = this.packages.get(pkg.name) || [];
    const existingVersion = versions.find((v) => v.version === pkg.version);

    if (existingVersion) {
      return;
    }

    versions.push({
      name: pkg.name,
      version: pkg.version,
      requiredAt: Date.now(),
    });

    this.packages.set(pkg.name, versions);
  }

  asArray() {
    return Array.from(this.packages.values()).flat();
  }

  clear() {
    this.packages.clear();
  }
}
