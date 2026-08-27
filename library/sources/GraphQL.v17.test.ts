import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createGraphQLTests } from "./GraphQL.tests";

if (getMajorNodeVersion() >= 20) {
  createGraphQLTests("graphql-v17");
}
