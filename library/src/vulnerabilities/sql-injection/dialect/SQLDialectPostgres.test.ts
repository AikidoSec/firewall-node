import * as t from "tap";
import { SQLDialectPostgres } from "./SQLDialectPostgres";
import { Range } from "./SQLDialect";

t.test("it understands Postgres escaping rules", async (t) => {
  const postgres = new SQLDialectPostgres();
  const checks: [string, Range[]][] = [
    [``, []],
    [` `, []],
    [`SELECT * FROM users`, []],
    [`SELECT * FROM users WHERE id = '`, []],
    [`SELECT * FROM users WHERE id = "`, []],
    [`SELECT * FROM users;`, []],
    [`SELECT * FROM users WHERE id = '';`, []],
    [`SELECT * FROM users -- WHERE id = '';`, []],
    [
      `SELECT * -- WHERE id = ''
       FROM users;`,
      [],
    ],
    [`SELECT * FROM users # WHERE id = '';`, []],
    [`SELECT * FROM users /* WHERE id = '' */`, []],
    [
      `SELECT * /* WHERE
      id = '' */
       FROM users`,
      [],
    ],
    [`SELECT * FROM users WHERE id = 'id';`, [[32, 33, "id"]]],
    [
      `SELECT * FROM users WHERE id = 'id' 'id';`,
      [
        [32, 33, "id"],
        [37, 38, "id"],
      ],
    ],
    [`SELECT * FROM users WHERE id = 'id' 'id;`, []],
    [`SELECT * FROM users WHERE id = ''id';`, []],
    [`SELECT * FROM users WHERE id = '\\'id';`, [[32, 35, "\\'id"]]],
    [`SELECT * FROM users WHERE id = '\\\\'id';`, []],
    [`SELECT * FROM users WHERE id = '\\\\\\'id';`, [[32, 37, "\\\\\\'id"]]],
    [`SELECT * FROM users WHERE id = '''id';`, [[32, 35, "''id"]]],
    [`SELECT * FROM users WHERE id = """id";`, []],
    [
      `SELECT * FROM users WHERE id = 'id' AND id = 'b';`,
      [
        [32, 33, "id"],
        [46, 46, "b"],
      ],
    ],
    [
      `SELECT *
       FROM users
       WHERE id = 'id'
         AND id = 'b';
      `,
      [
        [46, 47, "id"],
        [69, 69, "b"],
      ],
    ],
    [
      `SELECT * FROM users WHERE name = 'John' -- and 'Jane';`,
      [[34, 37, "John"]],
    ],
    [
      `SELECT * FROM users WHERE note = 'O\\'Reilly\\'s book';`,
      [[34, 50, "O\\'Reilly\\'s book"]],
    ],
    [`SELECT * FROM users WHERE path = 'C:\\\\\\\\'Documents\\\\\\';`, []],
    [
      `SELECT * FROM users WHERE name = 'Doe /* John */';`,
      [[34, 47, "Doe /* John */"]],
    ],
    [
      `SELECT * FROM logs WHERE message = 'Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.';`,
      [
        [
          36,
          101,
          "Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.",
        ],
      ],
    ],
    [
      `SELECT * FROM files WHERE data = x'4D7953514C' AND backup = b'01010101';`,
      [
        [35, 44, "4D7953514C"],
        [62, 69, "01010101"],
      ],
    ],
    [
      `SELECT * FROM messages WHERE greeting = CONCAT('Hello, ', '\\'world!\\'', ' How\\'s everything?');`,
      [
        [48, 54, "Hello, "],
        [59, 68, "\\'world!\\'"],
        [73, 91, " How\\'s everything?"],
      ],
    ],
    [
      `SELECT * FROM products WHERE description = 'It''s ''quoted'' text here';`,
      [[44, 69, "It''s ''quoted'' text here"]],
    ],
    [
      `SELECT * FROM code_snippets WHERE snippet = 'SELECT * FROM table -- where condition = \\'value\\'';`,
      [[45, 94, "SELECT * FROM table -- where condition = \\'value\\'"]],
    ],
    [
      `SELECT * FROM reviews WHERE comment = 'He said, \\"This is awesome!\\" But I think it\\'s just \\'okay\\'.';`,
      [
        [
          39,
          100,
          "He said, \\\"This is awesome!\\\" But I think it\\'s just \\'okay\\'.",
        ],
      ],
    ],
    [
      `SELECT $$This is a string with a $ sign in it$$;`,
      [[9, 44, "This is a string with a $ sign in it"]],
    ],
    [
      `SELECT $$This is a string with a $ sign ' in it$$;`,
      [[9, 46, "This is a string with a $ sign ' in it"]],
    ],
    [
      `SELECT $$This is a string with a $ -- sign ' in it$$;`,
      [[9, 49, "This is a string with a $ -- sign ' in it"]],
    ],
    [
      `SELECT $$This is a string with a $ /* sign in it$$;`,
      [[9, 47, "This is a string with a $ /* sign in it"]],
    ],
    [
      `SELECT $$This is a string with a $ /* sign */ in it$$;`,
      [[9, 50, "This is a string with a $ /* sign */ in it"]],
    ],
    [
      `SELECT $TAG$This is a string with a $ sign in it$TAG$;`,
      [[12, 47, "This is a string with a $ sign in it"]],
    ],
    [
      `
$function$
BEGIN
  RETURN ($1 ~ $q$[\\t\\r\\n\\v\\\\]$q$);
END;
$function$;`,
      [[11, 58, "\nBEGIN\n  RETURN ($1 ~ $q$[\\t\\r\\n\\v\\\\]$q$);\nEND;\n"]],
    ],
    [
      `SELECT * FROM functions WHERE definition = $$BEGIN RETURN $Q$SELECT 'Hello, World!';$Q$; END;$$;`,
      [[45, 92, "BEGIN RETURN $Q$SELECT 'Hello, World!';$Q$; END;"]],
    ],
    [
      `SELECT * FROM scripts WHERE content = $CustomTag$Incorrectly terminated string;`,
      [],
    ],
    [
      `SELECT * FROM articles WHERE body = $$He said, 'This is "quoted" text.'$$;`,
      [[38, 70, "He said, 'This is \"quoted\" text.'"]],
    ],
    [
      `SELECT * FROM articles WHERE body = $He said, 'This is "quoted" text.'$$;`,
      [],
    ],
    [
      `SELECT * FROM articles WHERE body = $$He said, 'This is "quoted" text.'$;`,
      [],
    ],
    [
      `SELECT * FROM articles WHERE body = $Tag$He said, 'This is "quoted" text.'$Tag$;`,
      [[41, 73, "He said, 'This is \"quoted\" text.'"]],
    ],
    [
      `SELECT * FROM articles WHERE body = $Tag$He said, 'This is "quoted" text.'$tag$;`,
      [],
    ],
    [
      `SELECT * FROM books /* Outer comment /!* Nested comment *!/ Outer continued */;`,
      [],
    ],
    [
      `SELECT * FROM comments WHERE text = 'This -- is not a comment.';`,
      [[37, 61, "This -- is not a comment."]],
    ],
    [
      `SELECT * FROM pages WHERE content = $A$This is a \'quoted\' text inside a dollar-quoted string$A$;`,
      [[39, 91, "This is a 'quoted' text inside a dollar-quoted string"]],
    ],
    [
      `
        SELECT * FROM MY_TABLE;
        UPDATE MY_TABLE SET A = 5;
        INSERT INTO MY_TABLE VALUES (3, 'hi there');
      `,
      [[109, 116, "hi there"]],
    ],
  ];

  for (const [input, expected] of checks) {
    t.same(postgres.getEscapedRanges(input), expected, input);
  }
});
