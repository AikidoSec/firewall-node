export class Hostnames {
  private map: Map<string, number | undefined> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  add(hostname: string, port: number | undefined) {
    if (this.map.has(hostname)) {
      return;
    }

    if (this.map.size >= this.maxEntries) {
      const firstAdded = this.map.keys().next().value;
      this.map.delete(firstAdded);
    }

    this.map.set(hostname, port);
  }

  asArray() {
    return Array.from(this.map.entries()).map(([hostname, port]) => {
      return {
        hostname,
        port,
      };
    });
  }

  clear() {
    this.map.clear();
  }
}
