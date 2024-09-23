import * as t from "tap";
import { parse, FieldNode } from "graphql";
import {
  extractTopLevelFieldsFromDocument,
  Result,
} from "./extractTopLevelFieldsFromDocument";

function convert(result: Result) {
  if (!result) {
    return result;
  }

  return {
    type: result.type,
    fields: result.fields.map((field) => field.name.value),
  };
}

t.test("it extract field names from query", async () => {
  const document = parse(`
    query {
      user {
        id
        name
      }
    }
  `);

  t.same(convert(extractTopLevelFieldsFromDocument(document, undefined)), {
    type: "query",
    fields: ["user"],
  });

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, "unknown")),
    undefined
  );
});

t.test("it extract field names from query", async () => {
  const document = parse(`
    {
      user {
        id
        name
      }
      account {
        id
        name
      }
    }
  `);

  t.same(convert(extractTopLevelFieldsFromDocument(document, undefined)), {
    type: "query",
    fields: ["user", "account"],
  });
});

t.test("it extract field names from query with multiple queries", async () => {
  const document = parse(`
    query getUser {
      user {
        id
        name
      }
    }

    query getAccount {
      account {
        id
        name
      }
    }
  `);

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, undefined)),
    undefined
  );

  t.same(convert(extractTopLevelFieldsFromDocument(document, "getUser")), {
    type: "query",
    fields: ["user"],
  });

  t.same(convert(extractTopLevelFieldsFromDocument(document, "getAccount")), {
    type: "query",
    fields: ["account"],
  });

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, "unknown")),
    undefined
  );
});

t.test("it extract field names from query (without query)", async () => {
  const document = parse(`
    {
      user {
        id
        name
      }
    }
  `);

  t.same(convert(extractTopLevelFieldsFromDocument(document, undefined)), {
    type: "query",
    fields: ["user"],
  });

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, "unknown")),
    undefined
  );
});

t.test("it extract field names from mutation", async () => {
  const document = parse(`
    mutation {
      user {
        id
        name
      }
    }
  `);

  t.same(convert(extractTopLevelFieldsFromDocument(document, undefined)), {
    type: "mutation",
    fields: ["user"],
  });

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, "unknown")),
    undefined
  );
});

t.test("it extract field names from mutation", async () => {
  const document = parse(`
    mutation addUser  {
      addUser {
        id
        name
      }
    }
  `);

  t.same(convert(extractTopLevelFieldsFromDocument(document, undefined)), {
    type: "mutation",
    fields: ["addUser"],
  });

  t.same(
    convert(extractTopLevelFieldsFromDocument(document, "unknown")),
    undefined
  );

  t.same(convert(extractTopLevelFieldsFromDocument(document, "addUser")), {
    type: "mutation",
    fields: ["addUser"],
  });
});
