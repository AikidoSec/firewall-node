import * as t from "tap";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { runWithContext } from "../agent/Context";
import { GraphQL } from "./GraphQL";
import { Token } from "../agent/api/Token";
import { createTestAgent } from "../helpers/createTestAgent";

function getTestContext() {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/graphql",
    query: {},
    headers: {},
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/graphql",
  };
}

t.test("it works", async () => {
  const api = new ReportingAPIForTesting();
  const agent = createTestAgent({
    api: api,
    token: new Token("123"),
  });

  agent.start([new GraphQL()]);

  const { graphql, buildSchema } =
    require("graphql") as typeof import("graphql");

  const dsl = `
type Mutation {
  createBook(title: String!, authorId: ID!): Book!
  createAuthor(name: String!): Author!
}

type Query {
  getBook(id: ID!): Book
  getAuthor(id: ID!): Author
}

type Book {
  id: ID!
  title: String!
  author: Author!
}

type Author {
  id: ID!
  name: String!
  books: [Book!]!
}`.trimStart();

  const schema = buildSchema(dsl);

  const root = {
    getBook: ({ id }: { id: string }) => {
      return {
        id: id,
        title: "Book Title",
        author: {
          id: "1",
          name: "Author Name",
          books: [],
        },
      };
    },
  };

  const query = async (variableValues: Record<string, unknown>) => {
    return await graphql({
      schema,
      source: `
        query getBook($id: ID!) {
          getBook(id: $id) {
            id
            title
            author {
              id
              name
              books {
                id
                title
              }
            }
          }
        }
      `,
      rootValue: root,
      variableValues: variableValues,
    });
  };

  api.clear();

  const hits = 3;

  await runWithContext(getTestContext(), async () => {
    for (let i = 0; i < hits; i++) {
      await query({ id: "1" });

      // Route is registered at the end of the request
      agent.onRouteExecute(getTestContext());
    }
  });

  await agent.flushStats(1000);

  t.same(api.getEvents().length, 1);
  const [heartbeat] = api.getEvents();
  t.match(heartbeat, {
    type: "heartbeat",
    routes: [
      {
        method: "POST",
        path: "/graphql",
        hits: hits,
        graphql: {
          type: "query",
          name: "getBook",
        },
        apispec: {},
        graphlQLSchema: undefined,
      },
      {
        method: "POST",
        path: "/graphql",
        hits: hits,
        graphql: undefined,
        apispec: {},
        graphlQLSchema: dsl,
      },
    ],
  });
});
