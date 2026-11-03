import * as t from "tap";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { createGraphQLToolTests } from "./GraphQL.tools.tests";

if (isVersionGreaterOrEqual("22.18.0", process.versions.node)) {
  createGraphQLToolTests("@graphql-tools/executor-v4");
} else {
  t.skip("@graphql-tools/executor v4 requires Node.js >= 22.18.0", () => {});
}
