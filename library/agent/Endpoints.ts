import { matchEndpoint } from "../helpers/matchEndpoint";
import { tryParseURL } from "../helpers/tryParseURL";
import { LRUMap } from "../ratelimiting/LRUMap";
import { Endpoint } from "./Config";
import { Context } from "./Context";

type LimitedContext = Pick<Context, "url" | "method" | "route">;

export class Endpoints {
  private readonly cached: LRUMap<
    string,
    { route: string; endpoint: Endpoint } | "__NO_MATCH__"
  > = new LRUMap(500, 60 * 1000);

  constructor(private readonly endpoints: Endpoint[]) {}

  fromContext(context: LimitedContext) {
    if (!context.method) {
      return undefined;
    }

    if (!context.route && !context.url) {
      return undefined;
    }

    const key = this.getCachingKey(context);
    const cached = this.cached.get(key);

    if (cached) {
      return cached === "__NO_MATCH__" ? undefined : cached;
    }

    const endpoint = matchEndpoint(context, this.endpoints);
    this.cached.set(key, endpoint ? endpoint : "__NO_MATCH__");

    return endpoint;
  }

  private getCachingKey(context: LimitedContext) {
    const { method, url, route } = context;
    let key = "";

    if (method) {
      key += `${method}`;
    }

    if (route) {
      key += `:${route}`;
    }

    if (url) {
      const parsed = tryParseURL(url);
      if (parsed) {
        key += `:${parsed.pathname}`;
      }
    }

    return key;
  }
}
