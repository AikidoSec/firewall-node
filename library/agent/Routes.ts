export class Routes {
  private routes: Map<string, { method: string; path: string; hits: number }> =
    new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addRoute(method: string, path: string) {
    const key = `${method}:${path}`;
    const existing = this.routes.get(key);

    if (existing) {
      existing.hits++;
      return;
    }

    if (this.routes.size >= this.maxEntries) {
      this.evictLeastUsedRoute();
    }

    this.routes.set(key, { method, path, hits: 1 });
  }

  private evictLeastUsedRoute() {
    let leastUsedKey: string | null = null;
    let leastHits = Infinity;

    for (const [key, route] of this.routes.entries()) {
      if (route.hits < leastHits) {
        leastHits = route.hits;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey !== null) {
      this.routes.delete(leastUsedKey);
    }
  }

  asArray() {
    return Array.from(this.routes.entries()).map(([key, route]) => {
      return {
        method: route.method,
        path: route.path,
        hits: route.hits,
      };
    });
  }
}
