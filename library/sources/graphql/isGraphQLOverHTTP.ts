import { Context } from "../../agent/Context";
import { isJsonContentType } from "../../helpers/isJsonContentType";
import { isPlainObject } from "../../helpers/isPlainObject";

export function isGraphQLOverHTTP(context: Context): boolean {
  if (context.method === "POST") {
    return (
      isGraphQLRoute(context) &&
      typeof context.headers["content-type"] === "string" &&
      isJsonContentType(context.headers["content-type"]) &&
      isPlainObject(context.body) &&
      typeof context.body.query === "string" &&
      looksLikeGraphQLQuery(context.body.query)
    );
  }

  if (context.method === "GET") {
    return (
      isGraphQLRoute(context) &&
      typeof context.query.query === "string" &&
      looksLikeGraphQLQuery(context.query.query)
    );
  }

  return false;
}

// Every GraphQL query should have at least curly braces
// e.g. { query { ... } }
// or without query keyword { ... }
// or with a mutation keyword { mutation { ... } }
function looksLikeGraphQLQuery(query: string): boolean {
  return query.includes("{") && query.includes("}");
}

function isGraphQLRoute(context: Context): boolean {
  if (!context.url) {
    return false;
  }

  return context.url.endsWith("/graphql");
}
