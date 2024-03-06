import * as t from "tap";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { Range } from "./SQLDialect";

t.test("it understands MySQL escaping rules", async (t) => {
  const mysql = new SQLDialectMySQL();
  const checks: [string, Range[]][] = [
    ["", []],
    [" ", []],
    ["SELECT * FROM users", []],
    ["SELECT * FROM users WHERE id = '", []],
    ['SELECT * FROM users WHERE id = "', []],
    ["SELECT * FROM users;", []],
    ["SELECT * FROM users WHERE id = '';", [[31, 32, ""]]],
    ["SELECT * FROM users WHERE id = 'id';", [[31, 34, "id"]]],
    [
      "SELECT * FROM users WHERE id = 'id' 'id';",
      [
        [31, 34, "id"],
        [36, 39, "id"],
      ],
    ],
    ["SELECT * FROM users WHERE id = 'id' 'id;", []],
    ["SELECT * FROM users WHERE id = ''id';", []],
    ["SELECT * FROM users WHERE id = '''id';", [[31, 36, "''id"]]],
    ['SELECT * FROM users WHERE id = """id";', [[31, 36, '""id']]],
    [
      "SELECT * FROM users WHERE id = 'id' AND id = 'b';",
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
  ];

  for (const [input, expected] of checks) {
    t.same(mysql.getEscapedRanges(input), expected, input);
  }
});
