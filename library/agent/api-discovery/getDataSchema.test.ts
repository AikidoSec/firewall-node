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

  t.same(
    getDataSchema({
      e: "test@example.com",
      i: "127.0.0.1",
      u: "http://example.com",
      d: "2024-10-14",
    }),
    {
      type: "object",
      properties: {
        e: {
          type: "string",
          format: "email",
        },
        i: {
          type: "string",
          format: "ipv4",
        },
        u: {
          type: "string",
          format: "uri",
        },
        d: {
          type: "string",
          format: "date",
        },
      },
    }
  );

  t.same(
    getDataSchema({
      e: [],
    }),
    {
      type: "object",
      properties: {
        e: {
          type: "array",
          items: null,
        },
      },
    }
  );
});

t.test("test max depth", async (t) => {
  const generateTestObjectWithDepth = (depth: number): object | string => {
    if (depth === 0) {
      return "testValue";
    }

    const obj = {
      prop: generateTestObjectWithDepth(depth - 1),
    };

    return obj;
  };

  const obj = generateTestObjectWithDepth(10);
  const schema = getDataSchema(obj);
  t.ok(JSON.stringify(schema).includes('"type":"string"'));

  const obj2 = generateTestObjectWithDepth(21);
  const schema2 = getDataSchema(obj2);
  t.notOk(JSON.stringify(schema2).includes('"type":"string"'));
});

t.test("test max properties", async (t) => {
  const generateObjectWithProperties = (count: number) => {
    const obj: any = {};
    for (let i = 0; i < count; i++) {
      obj[`prop${i}`] = i;
    }
    return obj;
  };

  const obj = generateObjectWithProperties(80);
  const schema = getDataSchema(obj);
  t.same(Object.keys(schema.properties!).length, 80);

  const obj2 = generateObjectWithProperties(120);
  const schema2 = getDataSchema(obj2);
  t.same(Object.keys(schema2.properties!).length, 100);
});
