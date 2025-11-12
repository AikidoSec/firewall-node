type PackageInfo = {
  name: string;
  version: string;
  requiredAt: number;
};

export class Packages {
  private packages: Map<string, PackageInfo[]> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 5000) {
    this.maxSize = maxSize;
  }

  addPackage(pkg: { name: string; version: string }) {
    if (this.packages.size >= this.maxSize) {
      return;
    }

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
