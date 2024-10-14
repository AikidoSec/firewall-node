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

t.test("empty array", async (t) => {
  t.same(mergeDataSchemas(getDataSchema([]), getDataSchema([])), {
    type: "array",
    items: undefined,
  });
});

t.test("it merges types", async (t) => {
  t.same(mergeDataSchemas(getDataSchema("str"), getDataSchema(15)), {
    type: ["string", "number"],
  });

  // Can not merge object with primitive type
  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "abc",
      }),
      getDataSchema(15)
    ),
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
    mergeDataSchemas(
      getDataSchema({
        test: "abc",
      }),
      getDataSchema({
        test: true,
      })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: ["string", "boolean"],
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "abc",
      }),
      mergeDataSchemas(
        getDataSchema({
          test: "abc",
        }),
        getDataSchema({
          test: true,
        })
      )
    ),
    {
      type: "object",
      properties: {
        test: {
          type: ["string", "boolean"],
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      mergeDataSchemas(
        getDataSchema({
          test: true,
        }),
        getDataSchema({
          test: "test",
        })
      ),
      getDataSchema({
        test: "abc",
      })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: ["boolean", "string"],
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "abc",
      }),
      mergeDataSchemas(
        getDataSchema({
          test: 123,
        }),
        getDataSchema({
          test: true,
        })
      )
    ),
    {
      type: "object",
      properties: {
        test: {
          type: ["string", "number", "boolean"],
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      mergeDataSchemas(
        getDataSchema({
          test: "test",
        }),
        getDataSchema({
          test: true,
        })
      ),
      mergeDataSchemas(
        getDataSchema({
          test: 123,
        }),
        getDataSchema({
          test: true,
        })
      )
    ),
    {
      type: "object",
      properties: {
        test: {
          type: ["string", "boolean", "number"],
        },
      },
    }
  );
});

t.test("with string format", async (t) => {
  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "test@example.com",
      }),
      getDataSchema({
        test: "",
      })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
          format: "email",
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "",
      }),
      getDataSchema({
        test: "127.0.0.1",
      })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
          format: "ipv4",
        },
      },
    }
  );

  t.same(
    mergeDataSchemas(
      getDataSchema({
        test: "http://example.com",
      }),
      getDataSchema({
        test: "2024-10-14",
      })
    ),
    {
      type: "object",
      properties: {
        test: {
          type: "string",
          format: "uri",
        },
      },
    }
  );
});
