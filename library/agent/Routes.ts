export class Routes {
  private routes: Map<
    string,
    {
      method: string;
      path: string;
      hits: number;
      graphQLFields: { type: "query" | "mutation"; name: string }[];
    }
  > = new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addRoute(method: string, path: string) {
    const key = this.getKey(method, path);
    const existing = this.routes.get(key);

    if (existing) {
      existing.hits++;
      return;
    }

    if (this.routes.size >= this.maxEntries) {
      this.evictLeastUsedRoute();
    }

    this.routes.set(key, { method, path, hits: 1, graphQLFields: [] });
  }

  private getKey(method: string, path: string) {
    return `${method}:${path}`;
  }

  addGraphQLField(
    method: string,
    path: string,
    type: "query" | "mutation",
    name: string
  ) {
    const key = this.getKey(method, path);
    const route = this.routes.get(key);

    if (route && !route.graphQLFields.some((field) => field.name === name)) {
      route.graphQLFields.push({ type, name });
    }
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

  clear() {
    this.routes.clear();
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
