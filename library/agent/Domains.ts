export class Domains {
  private map: Map<string, string> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  add(domain: string) {
    if (this.map.has(domain)) {
      return;
    }

    if (this.map.size >= this.maxEntries) {
      const firstAdded = this.map.keys().next().value;
      this.map.delete(firstAdded);
    }

    this.map.set(domain, domain);
  }

  getDomains() {
    return Array.from(this.map.keys());
  }

  clear() {
    this.map.clear();
  }
}
