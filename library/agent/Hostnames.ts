type Ports = Set<number | undefined>;

export class Hostnames {
  private map: Map<string, Ports> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  add(hostname: string, port: number | undefined) {
    if (!this.map.has(hostname)) {
      this.map.set(hostname, new Set([port]));
    } else {
      this.map.get(hostname)?.add(port);
    }

    if (this.length > this.maxEntries) {
      const firstAdded: string = this.map.keys().next().value;
      const ports: Ports = this.map.get(firstAdded) as Ports;

      if (ports.size > 1) {
        const firstPort = ports.values().next().value;
        ports.delete(firstPort);
      } else {
        this.map.delete(firstAdded);
      }
    }
  }

  get length() {
    return Array.from(this.map.values()).reduce(
      (total: number, ports: Ports) => total + ports.size,
      0
    );
  }

  asArray() {
    return Array.from(this.map.entries()).flatMap(([hostname, ports]) =>
      Array.from(ports).map((port) => ({ hostname, port }))
    );
  }

  clear() {
    this.map.clear();
  }
}
