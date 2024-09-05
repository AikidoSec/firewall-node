import { BodyDataType, getBodyDataType } from "./api-discovery/getBodyDataType";
import { DataShape, getDataShape } from "./api-discovery/getDataShape";
import { Context } from "./Context";

export class Routes {
  private routes: Map<
    string,
    {
      method: string;
      path: string;
      hits: number;
      graphql?: { type: "query" | "mutation"; name: string };
      body?: {
        type: BodyDataType;
        shape: DataShape;
      };
    }
  > = new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addRoute(context: Context) {
    const { method, route: path } = context;
    if (!method || !path) {
      return;
    }

    const key = this.getKey(method, path);
    const existing = this.routes.get(key);

    if (existing) {
      // Todo merge body
      existing.hits++;
      return;
    }

    this.evictLeastUsedRouteIfNecessary();
    this.routes.set(key, {
      method,
      path,
      hits: 1,
      body: this.getBodyInfo(context),
    });
  }

  private getBodyInfo(context: Context) {
    if (!context.body || typeof context.body !== "object") {
      // Ignore body if it's not an object and only a primitive (string, number, etc.)
      return undefined;
    }
    try {
      return {
        type: getBodyDataType(context.headers),
        shape: getDataShape(context.body),
      };
    } catch {
      return undefined;
    }
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
