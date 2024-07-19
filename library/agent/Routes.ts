export class Routes {
  private routes: Map<
    string,
    {
      method: string;
      path: string;
      hits: number;
      graphql?: { type: "query" | "mutation"; name: string };
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

    this.evictLeastUsedRouteIfNecessary();
    this.routes.set(key, { method, path, hits: 1 });
  }

  private evictLeastUsedRouteIfNecessary() {
    if (this.routes.size >= this.maxEntries) {
      this.evictLeastUsedRoute();
    }
  }

  private getKey(method: string, path: string) {
    return `${method}:${path}`;
  }

  private getGraphQLKey(
    method: string,
    path: string,
    type: "query" | "mutation",
    name: string
  ) {
    return `${method}:${path}:${type}:${name}`;
  }

  addGraphQLField(
    method: string,
    path: string,
    type: "query" | "mutation",
    name: string
  ) {
    const key = this.getGraphQLKey(method, path, type, name);
    const existing = this.routes.get(key);

    if (existing) {
      existing.hits++;
      return;
    }

    this.evictLeastUsedRouteIfNecessary();
    this.routes.set(key, { method, path, hits: 1, graphql: { type, name } });
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
        graphql: route.graphql,
      };
    });
  }
}
