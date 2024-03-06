import * as t from "tap";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { Range } from "./SQLDialect";

t.test("it understands MySQL escaping rules", async (t) => {
  const mysql = new SQLDialectMySQL();
  const checks: [string, Range[]][] = [
    [``, []],
    [` `, []],
    [`SELECT * FROM users`, []],
    [`SELECT * FROM users WHERE id = '`, []],
    [`SELECT * FROM users WHERE id = "`, []],
    [`SELECT * FROM users;`, []],
    [`SELECT * FROM users WHERE id = '';`, [[31, 32, ""]]],
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
    [`SELECT * FROM users WHERE id = 'id';`, [[31, 34, "id"]]],
    [
      `SELECT * FROM users WHERE id = 'id' 'id';`,
      [
        [31, 34, "id"],
        [36, 39, "id"],
      ],
    ],
    [`SELECT * FROM users WHERE id = 'id' 'id;`, []],
    [`SELECT * FROM users WHERE id = ''id';`, []],
    [`SELECT * FROM users WHERE id = '\\'id';`, [[31, 36, "\\'id"]]],
    [`SELECT * FROM users WHERE id = '\\\\'id';`, []],
    [`SELECT * FROM users WHERE id = '\\\\\\'id';`, [[31, 38, "\\\\\\'id"]]],
    [`SELECT * FROM users WHERE id = '''id';`, [[31, 36, "''id"]]],
    [`SELECT * FROM users WHERE id = """id";`, [[31, 36, '""id']]],
    [
      `SELECT * FROM users WHERE id = 'id' AND id = 'b';`,
      [
        [31, 34, "id"],
        [45, 47, "b"],
      ],
    ],
    [
      `SELECT *
        FROM users
        WHERE id = 'id'
        AND id = 'b';
      `,
      [
        [47, 50, "id"],
        [69, 71, "b"],
      ],
    ],
    [
      `SELECT * FROM users WHERE name = 'John' -- and 'Jane';`,
      [[33, 38, "John"]],
    ],
    [
      `SELECT * FROM users WHERE note = 'O\\'Reilly\\'s book';`,
      [[33, 51, "O\\'Reilly\\'s book"]],
    ],
    [`SELECT * FROM users WHERE path = 'C:\\\\\\\\'Documents\\\\\\';`, []],
    [
      `SELECT * FROM users WHERE name = 'Doe /* John */';`,
      [[33, 48, "Doe /* John */"]],
    ],
    [
      `SELECT * FROM logs WHERE message = 'Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.';`,
      [
        [
          35,
          102,
          "Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.",
        ],
      ],
    ],
    [
      `SELECT * FROM files WHERE data = x'4D7953514C' AND backup = b'01010101';`,
      [
        [34, 45, "4D7953514C"],
        [61, 70, "01010101"],
      ],
    ],
    [
      `SELECT * FROM messages WHERE greeting = CONCAT('Hello, ', '\\'world!\\'', ' How\\'s everything?');`,
      [
        [47, 55, "Hello, "],
        [58, 69, "\\'world!\\'"],
        [72, 92, " How\\'s everything?"],
      ],
    ],
    [
      `SELECT * FROM products WHERE description = 'It''s ''quoted'' text here';`,
      [[43, 70, "It''s ''quoted'' text here"]],
    ],
    [
      `SELECT * FROM code_snippets WHERE snippet = 'SELECT * FROM table -- where condition = \\'value\\'';`,
      [[44, 95, "SELECT * FROM table -- where condition = \\'value\\'"]],
    ],
    [
      `SELECT * FROM reviews WHERE comment = 'He said, \\"This is awesome!\\" But I think it\\'s just \\'okay\\'.';`,
      [
        [
          38,
          101,
          "He said, \\\"This is awesome!\\\" But I think it\\'s just \\'okay\\'.",
        ],
      ],
    ],
  ];

  for (const [input, expected] of checks) {
    t.same(mysql.getEscapedRanges(input), expected, input);
  }
});
