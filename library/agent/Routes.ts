import { getMaxApiDiscoverySamples } from "../helpers/getMaxApiDiscoverySamples";
import { type APISpec, getApiInfo } from "./api-discovery/getApiInfo";
import { updateApiInfo } from "./api-discovery/updateApiInfo";
import { isAikidoDASTRequest } from "./AikidoDAST";
import { Endpoint } from "./Config";
import type { Context } from "./Context";

export type Route = {
  method: string;
  path: string;
  hits: number;
  rateLimitedCount: number;
  graphql?: { type: "query" | "mutation"; name: string };
  apispec: APISpec;
};

export class Routes {
  // Routes are only registered at the end of the request, so we need to store the schema in a separate map
  private graphQLSchemas: Map<string, string> = new Map();
  private routes: Map<string, Route> = new Map();

  constructor(
    private readonly maxEntries: number = 1000,
    private readonly maxGraphQLSchemas = 10
  ) {}

  addRoute(context: Context) {
    if (isAikidoDASTRequest(context)) {
      return;
    }

    const { method, route: path } = context;
    if (!method || !path) {
      return;
    }

    const key = this.getKey(method, path);
    const existing = this.routes.get(key);
    const maxSamples = getMaxApiDiscoverySamples();

    if (existing) {
      updateApiInfo(context, existing, maxSamples);

      existing.hits++;
      return;
    }

    // Get info about body and query schema
    let apispec: APISpec = {};
    if (maxSamples > 0) {
      apispec = getApiInfo(context) || {};
    }

    this.evictLeastUsedRouteIfNecessary();
    this.routes.set(key, {
      method,
      path,
      hits: 1,
      apispec,
      rateLimitedCount: 0,
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

  hasGraphQLSchema(method: string, path: string): boolean {
    const key = this.getKey(method, path);

    return this.graphQLSchemas.has(key);
  }

  setGraphQLSchema(method: string, path: string, schema: string) {
    if (
      schema.length > 0 &&
      this.graphQLSchemas.size < this.maxGraphQLSchemas
    ) {
      const key = this.getKey(method, path);
      this.graphQLSchemas.set(key, schema);
    }
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
      rateLimitedCount: 0,
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

  countRouteRateLimited(route: Endpoint) {
    let key = this.getKey(route.method, route.route);
    if (route.graphql) {
      key = this.getGraphQLKey(
        route.method,
        route.route,
        route.graphql.type,
        route.graphql.name
      );
    }
    let existing = this.routes.get(key);

    if (!existing) {
      this.evictLeastUsedRouteIfNecessary();
      existing = {
        method: route.method,
        path: route.route,
        graphql: route.graphql
          ? { type: route.graphql.type, name: route.graphql.name }
          : undefined,
        hits: 0,
        apispec: {},
        rateLimitedCount: 0,
      };
      this.routes.set(key, existing);
    }

    existing.rateLimitedCount++;
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
        rateLimitedCount: route.rateLimitedCount,
        graphql: route.graphql,
        apispec: route.apispec,
        graphQLSchema: this.graphQLSchemas.get(key),
      };
    });
  }
}
