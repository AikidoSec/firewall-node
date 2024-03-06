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
    [`SELECT * FROM users WHERE id = 'id';`, [[32, 34, "id"]]],
    [
      `SELECT * FROM users WHERE id = 'id' 'id';`,
      [
        [32, 34, "id"],
        [37, 39, "id"],
      ],
    ],
    [`SELECT * FROM users WHERE id = 'id' 'id;`, []],
    [`SELECT * FROM users WHERE id = ''id';`, []],
    [`SELECT * FROM users WHERE id = '\\'id';`, [[32, 36, "\\'id"]]],
    [`SELECT * FROM users WHERE id = '\\\\'id';`, []],
    [`SELECT * FROM users WHERE id = '\\\\\\'id';`, [[32, 38, "\\\\\\'id"]]],
    [`SELECT * FROM users WHERE id = '''id';`, [[32, 36, "''id"]]],
    [`SELECT * FROM users WHERE id = """id";`, [[32, 36, '""id']]],
    [
      `SELECT * FROM users WHERE id = 'id' AND id = 'b';`,
      [
        [32, 34, "id"],
        [46, 47, "b"],
      ],
    ],
    [
      `SELECT *
        FROM users
        WHERE id = 'id'
        AND id = 'b';
      `,
      [
        [48, 50, "id"],
        [70, 71, "b"],
      ],
    ],
    [
      `SELECT * FROM users WHERE name = 'John' -- and 'Jane';`,
      [[34, 38, "John"]],
    ],
    [
      `SELECT * FROM users WHERE note = 'O\\'Reilly\\'s book';`,
      [[34, 51, "O\\'Reilly\\'s book"]],
    ],
    [`SELECT * FROM users WHERE path = 'C:\\\\\\\\'Documents\\\\\\';`, []],
    [
      `SELECT * FROM users WHERE name = 'Doe /* John */';`,
      [[34, 48, "Doe /* John */"]],
    ],
    [
      `SELECT * FROM logs WHERE message = 'Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.';`,
      [
        [
          36,
          102,
          "Error: Invalid path \\'/home/user/docs\\'\\\\nRetry with a valid path.",
        ],
      ],
    ],
    [
      `SELECT * FROM files WHERE data = x'4D7953514C' AND backup = b'01010101';`,
      [
        [35, 45, "4D7953514C"],
        [62, 70, "01010101"],
      ],
    ],
    [
      `SELECT * FROM messages WHERE greeting = CONCAT('Hello, ', '\\'world!\\'', ' How\\'s everything?');`,
      [
        [48, 55, "Hello, "],
        [59, 69, "\\'world!\\'"],
        [73, 92, " How\\'s everything?"],
      ],
    ],
    [
      `SELECT * FROM products WHERE description = 'It''s ''quoted'' text here';`,
      [[44, 70, "It''s ''quoted'' text here"]],
    ],
    [
      `SELECT * FROM code_snippets WHERE snippet = 'SELECT * FROM table -- where condition = \\'value\\'';`,
      [[45, 95, "SELECT * FROM table -- where condition = \\'value\\'"]],
    ],
    [
      `SELECT * FROM reviews WHERE comment = 'He said, \\"This is awesome!\\" But I think it\\'s just \\'okay\\'.';`,
      [
        [
          39,
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
