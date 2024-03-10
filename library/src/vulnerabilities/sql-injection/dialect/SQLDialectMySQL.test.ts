import * as t from "tap";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { Range } from "./SQLDialect";

t.test("it understands MySQL escaping rules", async (t) => {
  const mysql = new SQLDialectMySQL();
  const checks: [string, Range[] | Error][] = [
    [``, []],
    [` `, []],
    [`SELECT * FROM users`, []],
    [
      `SELECT * FROM users WHERE id = '`,
      new Error("Unclosed ' starting at position 31"),
    ],
    [
      `SELECT * FROM users WHERE id = "`,
      new Error('Unclosed " starting at position 31'),
    ],
    [`SELECT * FROM users;`, []],
    ["SELECT * FROM `users`;", [[15, 19, "users"]]],
    ["SELECT * FROM `use``rs`;", [[15, 21, "use``rs"]]],
    [
      "SELECT * FROM `use\\`rs`;",
      new Error("Unclosed ` starting at position 22"),
    ],
    ["SELECT * FROM `users --`;", [[15, 22, "users --"]]],
    ["SELECT * FROM `users #`;", [[15, 21, "users #"]]],
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
    [
      `SELECT * FROM users WHERE id = 'id' 'id;`,
      new Error("Unclosed ' starting at position 36"),
    ],
    [`SELECT * FROM users WHERE id = ''id';`, []],
    [`SELECT * FROM users WHERE id = '\\'id';`, [[32, 35, "\\'id"]]],
    [`SELECT * FROM users WHERE id = '\\\\'id';`, []],
    [`SELECT * FROM users WHERE id = '\\\\\\'id';`, [[32, 37, "\\\\\\'id"]]],
    [`SELECT * FROM users WHERE id = '''id';`, [[32, 35, "''id"]]],
    [`SELECT * FROM users WHERE id = """id";`, [[32, 35, '""id']]],
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
        [48, 49, "id"],
        [70, 70, "b"],
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
  ];

  for (const [input, expected] of checks) {
    if (expected instanceof Error) {
      const error = t.throws(() => mysql.getEscapedRanges(input), input);
      if (error instanceof Error) {
        t.match(error.message, expected.message, input);
      }
    } else {
      try {
        t.same(mysql.getEscapedRanges(input), expected, input);
      } catch (error) {
        t.fail(`${input} threw an error: ${error.message}`);
      }
    }
  }
});
