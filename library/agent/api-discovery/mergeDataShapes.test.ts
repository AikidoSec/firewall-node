import * as t from "tap";
import { mergeDataShapes } from "./mergeDataShapes";
import { getDataShape } from "./getDataShape";

t.test("it works", async (t) => {
  t.same(
    mergeDataShapes(
      getDataShape({ test: "abc" }),
      getDataShape({ test2: "abc" })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
        },
        test2: {
          type: "string",
        },
      },
    }
  );

  t.same(
    mergeDataShapes(
      getDataShape({ test: "abc", x: { a: 1 } }),
      getDataShape({ test: "abc", x: { b: 2 } })
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
            },
          },
        },
      },
    }
  );

  t.same(
    mergeDataShapes(
      getDataShape({ test: "abc", x: { a: 1 }, arr: [1, 2] }),
      getDataShape({ test: "abc", x: { a: 1, b: 2 }, arr: [1, 2, 3] })
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
  t.same(mergeDataShapes(getDataShape({ test: "abc" }), getDataShape(null)), {
    type: "object",
    properties: {
      test: {
        type: "string",
      },
    },
  });

  t.same(mergeDataShapes(getDataShape(null), getDataShape({ test: "abc" })), {
    type: "object",
    properties: {
      test: {
        type: "string",
      },
    },
  });
});
