type Ports = Map<
  number,
  {
    hits: number;
    blockedHits: number;
  }
>;

export class Hostnames {
  private map: Map<string, Ports> = new Map();

  constructor(private readonly maxEntries: number = 200) {}

  add(hostname: string, port: number, blocked = false) {
    if (port <= 0) {
      return;
    }

    if (!this.map.has(hostname)) {
      this.map.set(
        hostname,
        new Map([
          [
            port,
            {
              hits: 1,
              blockedHits: blocked ? 1 : 0,
            },
          ],
        ])
      );
    } else {
      const ports = this.map.get(hostname) as Ports;
      if (!ports.has(port)) {
        ports.set(port, {
          hits: 1,
          blockedHits: blocked ? 1 : 0,
        });
      } else {
        ports.set(port, {
          hits: ports.get(port)!.hits + 1,
          blockedHits: blocked
            ? ports.get(port)!.blockedHits + 1
            : ports.get(port)!.blockedHits,
        });
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
      Array.from(ports.entries()).map(([port, stats]) => {
        return {
          hostname,
          port,
          hits: stats.hits,
          blockedHits: stats.blockedHits,
        };
      })
    );
  }

  clear() {
    this.map.clear();
  }
}
