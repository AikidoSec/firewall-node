import { type APISpec, getApiInfo } from "./api-discovery/getApiInfo";
import { updateApiInfo } from "./api-discovery/updateApiInfo";
import type { Context } from "./Context";

export type Route = {
  method: string;
  path: string;
  hits: number;
  graphql?: { type: "query" | "mutation"; name: string };
  apispec: APISpec;
};

export class Routes {
  private routes: Map<string, Route> = new Map();

  constructor(private readonly maxEntries: number = 1000) {}

  addRoute(context: Context) {
    const { method, route: path } = context;
    if (!method || !path) {
      return;
    }

    const key = this.getKey(method, path);
    const existing = this.routes.get(key);

    if (existing) {
      // Only sample first 20 hits of a route during one heartbeat window
      if (existing.hits <= 20) {
        // Update api schemas if necessary
        updateApiInfo(context, existing);
      }

      existing.hits++;
      return;
    }

    // Get info about body and query schema
    const apispec = getApiInfo(context) || {};

    this.evictLeastUsedRouteIfNecessary();
    this.routes.set(key, {
      method,
      path,
      hits: 1,
      apispec,
    });
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
    this.routes.set(key, {
      method,
      path,
      hits: 1,
      graphql: { type, name },
      apispec: {},
    });
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
        apispec: route.apispec,
      };
    });
  }
}
