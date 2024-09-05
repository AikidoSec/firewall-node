import * as t from "tap";
import { getDataSchema } from "./getDataSchema";

t.test("it works", async (t) => {
  t.same(getDataSchema("test"), {
    type: "string",
  });

  t.same(getDataSchema(["test"]), {
    type: "array",
    items: {
      type: "string",
    },
  });

  t.same(getDataSchema({ test: "abc" }), {
    type: "object",
    properties: {
      test: {
        type: "string",
      },
    },
  });

  t.same(getDataSchema({ test: 123, arr: [1, 2, 3] }), {
    type: "object",
    properties: {
      test: {
        type: "number",
      },
      arr: {
        type: "array",
        items: {
          type: "number",
        },
      },
    },
  });

  t.same(getDataSchema({ test: 123, arr: [{ sub: true }], x: null }), {
    type: "object",
    properties: {
      test: {
        type: "number",
      },
      arr: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sub: {
              type: "boolean",
            },
          },
        },
      },
      x: {
        type: "null",
      },
    },
  });

  t.same(
    getDataSchema({
      test: {
        x: {
          y: {
            z: 123,
          },
        },
      },
      arr: [],
    }),
    {
      type: "object",
      properties: {
        test: {
          type: "object",
          properties: {
            x: {
              type: "object",
              properties: {
                y: {
                  type: "object",
                  properties: {
                    z: {
                      type: "number",
                    },
                  },
                },
              },
            },
          },
        },
        arr: {
          type: "array",
          items: undefined,
        },
      },
    }
  );
});

function generateTestObjectWithDepth(depth: number): any {
  if (depth === 0) {
    return "testValue";
  }

  const obj = {
    prop: generateTestObjectWithDepth(depth - 1),
  };

  return obj;
}

t.test("test max depth", async (t) => {
  const obj = generateTestObjectWithDepth(10);
  const shape = getDataSchema(obj);
  t.ok(JSON.stringify(shape).includes('"type":"string"'));

  const obj2 = generateTestObjectWithDepth(21);
  const shape2 = getDataSchema(obj2);
  t.notOk(JSON.stringify(shape2).includes('"type":"string"'));
});
