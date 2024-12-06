type Ports = Map<number, number>;

export class Hostnames {
  private map: Map<string, Ports> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  private portKey(port: number | undefined) {
    return port === undefined ? "__NO_PORT__" : port.toString();
  }

  private keyToPort(key: string) {
    return key === "__NO_PORT__" ? undefined : parseInt(key, 10);
  }

  add(hostname: string, port: number | undefined = -1) {
    if (!this.map.has(hostname)) {
      this.map.set(hostname, new Map([[port, 1]]));
    } else {
      const ports = this.map.get(hostname) as Ports;
      if (!ports.has(port)) {
        ports.set(port, 1);
      } else {
        ports.set(port, ports.get(port)! + 1);
      }
    }

    if (this.length > this.maxEntries) {
      const firstAdded = this.map.keys().next().value;
      if (firstAdded) {
        const ports: Ports = this.map.get(firstAdded) as Ports;

        if (ports.size > 1) {
          const firstPort = ports.keys().next().value;
          if (firstPort) {
            ports.delete(firstPort);
          }
        } else {
          this.map.delete(firstAdded);
        }
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
      Array.from(ports.entries()).map(([port, hits]) => {
        return {
          hostname,
          port: port === -1 ? undefined : port,
          hits,
        };
      })
    );
  }

  clear() {
    this.map.clear();
  }
}
