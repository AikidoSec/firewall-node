import * as t from "tap";
import { mergeDataSchemas } from "./mergeDataSchemas";
import { getDataSchema } from "./getDataSchema";

t.test("it works", async (t) => {
  t.same(
    mergeDataSchemas(
      getDataSchema({ test: "abc" }),
      getDataSchema({ test2: "abc" })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
          optional: true,
        },
        test2: {
          type: "string",
          optional: true,
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({ test: "abc", x: { a: 1 } }),
      getDataSchema({ test: "abc", x: { b: 2 } })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
        },
        x: {
          type: "object",
          properties: {
            a: {
              type: "number",
              optional: true,
            },
            b: {
              type: "number",
              optional: true,
            },
          },
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({ test: "abc", x: { a: 1 }, arr: [1, 2] }),
      getDataSchema({ test: "abc", x: { a: 1, b: 2 }, arr: [1, 2, 3] })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
        },
        x: {
          type: "object",
          properties: {
            a: {
              type: "number",
            },
            b: {
              type: "number",
              optional: true,
            },
          },
        },
        arr: {
          type: "array",
          items: {
            type: "number",
          },
        },
      },
    }
  );
});

t.test("it prefers non-null type", async (t) => {
  t.same(
    mergeDataSchemas(getDataSchema({ test: "abc" }), getDataSchema(null)),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(getDataSchema(null), getDataSchema({ test: "abc" })),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
        },
      },
    }
  );
});
