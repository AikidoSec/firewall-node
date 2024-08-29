import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { SQL_DANGEROUS_IN_STRING, SQL_KEYWORDS } from "./config";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";

const BAD_SQL_COMMANDS = [
  // Check for SQL Commands like : INSERT or DROP
  "Roses are red insErt are blue",
  "Roses are red cREATE are blue",
  "Roses are red drop are blue",
  "Roses are red updatE are blue",
  "Roses are red SELECT are blue",
  "Roses are red dataBASE are blue",
  "Roses are red alter are blue",
  "Roses are red grant are blue",
  "Roses are red savepoint are blue",
  "Roses are red commit are blue",
  "Roses are red or blue",
  "Roses are red and lovely",
  "This is a group_concat_test",
  // Test some special characters
  "I'm writting you",
  "Termin;ate",
  "Roses <> violets",
  "Roses < Violets",
  "Roses > Violets",
  "Roses != Violets",
];

const GOOD_SQL_COMMANDS = [
  // Check for SQL Commands with allowed characters
  "Roses are red rollbacks are blue",
  "Roses are red truncates are blue",
  "Roses are reddelete are blue",
  "Roses are red WHEREis blue",
  "Roses are red ORis isAND",
  // Check for some general statements
  `abcdefghijklmnop@hotmail.com`,
  // Test some special characters
  "steve@yahoo.com",
  // Test SQL Function (that should not be blocked)
  "I was benchmark ing",
  "We were delay ed",
  "I will waitfor you",
  // Allow single characters
  "#",
  "'",
];

const IS_NOT_INJECTION = [
  [`'UNION 123' UNION "UNION 123"`, "UNION 123"], // String encapsulation
  [`'union'  is not "UNION"`, "UNION!"], // String not present in SQL
  [`"UNION;"`, "UNION;"], // String encapsulation
  ["SELECT * FROM table", "*"],
  [`"COPY/*"`, "COPY/*"], // String encapsulated but dangerous chars
  [`'union'  is not "UNION--"`, "UNION--"], // String encapsulated but dangerous chars
  [`'union'  is not UNION`, "UNION"], // String not always encapsulated
];

const IS_INJECTION = [
  [`UNTER;`, "UNTER;"], // String not encapsulated and dangerous char (;)
];

t.test(
  "Test the detectSQLInjection() function",
  { skip: "memory leak" },
  async () => {
    for (const sql of BAD_SQL_COMMANDS) {
      isSqlInjection(sql, sql);
    }
    for (const sql of GOOD_SQL_COMMANDS) {
      isNotSqlInjection(sql, sql);
    }
  }
);

t.test(
  "Test detectSQLInjection() function",
  { skip: "memory leak" },
  async () => {
    for (const test of IS_INJECTION) {
      isSqlInjection(test[0], test[1]);
    }
    for (const test of IS_NOT_INJECTION) {
      isNotSqlInjection(test[0], test[1]);
    }
  }
);

t.test("It allows escape sequences", { skip: "memory leak" }, async () => {
  isSqlInjection("SELECT * FROM users WHERE id = 'users\\'", "users\\");
  isSqlInjection("SELECT * FROM users WHERE id = 'users\\\\'", "users\\\\");

  isNotSqlInjection("SELECT * FROM users WHERE id = '\nusers'", "\nusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\rusers'", "\rusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\tusers'", "\tusers");
});

t.test("user input inside IN (...)", { skip: "memory leak" }, async () => {
  isSqlInjection("SELECT * FROM users WHERE id IN ('123')", "'123'");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "456");
  isNotSqlInjection("SELECT * FROM users WHERE id IN ('123')", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (13,14,15)", "13,14,15");
  isNotSqlInjection(
    "SELECT * FROM users WHERE id IN (13, 14, 154)",
    "13, 14, 154"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id IN (13, 14, 154) OR (1=1)",
    "13, 14, 154) OR (1=1"
  );
});

t.test(
  "It checks whether the string is safely escaped",
  { skip: "memory leak" },
  async () => {
    isSqlInjection(
      `SELECT * FROM comments WHERE comment = 'I'm writting you'`,
      "I'm writting you"
    );
    isSqlInjection(
      `SELECT * FROM comments WHERE comment = "I"m writting you"`,
      'I"m writting you'
    );
    isSqlInjection("SELECT * FROM `comm`ents`", "`comm`ents");

    isNotSqlInjection(
      `SELECT * FROM comments WHERE comment = "I'm writting you"`,
      "I'm writting you"
    );
    isNotSqlInjection(
      `SELECT * FROM comments WHERE comment = 'I"m writting you'`,
      'I"m writting you'
    );
    isNotSqlInjection(
      `SELECT * FROM comments WHERE comment = "I\`m writting you"`,
      "I`m writting you"
    );
    isNotSqlInjection("SELECT * FROM `comm'ents`", "comm'ents");
  }
);

t.test(
  "it does not flag queries starting with SELECT and having select in user input",
  async () => {
    isNotSqlInjection("SELECT * FROM users WHERE id = 1", "SELECT");
  }
);

t.test(
  "It does not flag escaped # as SQL injection",
  { skip: "memory leak" },
  async () => {
    isNotSqlInjection(
      "SELECT * FROM hashtags WHERE name = '#hashtag'",
      "#hashtag"
    );
  }
);

// Weird edge case, but we'll flag 'em as SQL injections for now
// Requires better understanding of the SQL syntax
t.test("Comment is same as user input", { skip: "memory leak" }, async () => {
  isSqlInjection(
    "SELECT * FROM hashtags WHERE name = '-- Query by name' -- Query by name",
    "-- Query by name"
  );
});

t.test("input occurs in comment", { skip: "memory leak" }, async () => {
  isNotSqlInjection(
    "SELECT * FROM hashtags WHERE name = 'name' -- Query by name",
    "name"
  );
});

t.test("User input is multiline", { skip: "memory leak" }, async () => {
  isSqlInjection(
    `SELECT * FROM users WHERE id = 'a'
OR 1=1#'`,
    `a'
OR 1=1#`
  );

  isNotSqlInjection(
    `SELECT * FROM users WHERE id = 'a
b
c';`,
    `a
b
c`
  );
});

t.test("user input is longer than query", { skip: "memory leak" }, async () => {
  isNotSqlInjection(
    `SELECT * FROM users`,
    `SELECT * FROM users WHERE id = 'a'`
  );
});

t.test(
  "It flags multiline queries correctly",
  { skip: "memory leak" },
  async () => {
    isSqlInjection(
      `
      SELECT * FROM \`users\`\`
      WHERE id = 123
    `,
      "users`"
    );
    isSqlInjection(
      `
        SELECT *
        FROM users
        WHERE id = '1' OR 1=1
      `,
      "1' OR 1=1"
    );
    isSqlInjection(
      `
      SELECT *
      FROM users
      WHERE id = '1' OR 1=1
        AND is_escaped = '1'' OR 1=1'
    `,
      "1' OR 1=1"
    );
    isSqlInjection(
      `
      SELECT *
      FROM users
      WHERE id = '1' OR 1=1
        AND is_escaped = "1' OR 1=1"
    `,
      "1' OR 1=1"
    );

    isNotSqlInjection(
      `
      SELECT * FROM \`users\`
      WHERE id = 123
    `,
      "123"
    );
    isNotSqlInjection(
      `
      SELECT * FROM \`us\`\`ers\`
      WHERE id = 123
    `,
      "users"
    );
    isNotSqlInjection(
      `
        SELECT * FROM users
        WHERE id = 123
    `,
      "123"
    );
    isNotSqlInjection(
      `
        SELECT * FROM users
        WHERE id = '123'
    `,
      "123"
    );
    isNotSqlInjection(
      `
      SELECT *
      FROM users
      WHERE is_escaped = "1' OR 1=1"
    `,
      "1' OR 1=1"
    );
  }
);

SQL_DANGEROUS_IN_STRING.forEach((dangerous) => {
  t.test(
    `It flags dangerous string ${dangerous} as SQL injection`,
    { skip: "memory leak" },
    async () => {
      // Needs to be longer than 1 char
      const input = `${dangerous} a`;
      isSqlInjection(`SELECT * FROM users WHERE ${input}`, input);
    }
  );
});

t.test(
  "It does not flag key keyword as SQL injection",
  { skip: "memory leak" },
  async () => {
    const query = `
      INSERT INTO businesses (
            business_id,
            created_at,
            updated_at,
            changed_at
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at),
                                  changed_at = VALUES(changed_at)
    `;

    isNotSqlInjection(query, "KEY");
    isNotSqlInjection(query, "VALUES");
    isNotSqlInjection(query, "ON");
    isNotSqlInjection(query, "UPDATE");
    isNotSqlInjection(query, "INSERT");
    isNotSqlInjection(query, "INTO");
  }
);

t.test(
  "It flags function calls as SQL injections",
  { skip: "memory leak" },
  async () => {
    isSqlInjection("foobar()", "foobar()");
    isSqlInjection("foobar(1234567)", "foobar(1234567)");
    isSqlInjection("foobar       ()", "foobar       ()");
    isSqlInjection(".foobar()", ".foobar()");
    isSqlInjection("20+foobar()", "20+foobar()");
    isSqlInjection("20-foobar(", "20-foobar(");
    isSqlInjection("20<foobar()", "20<foobar()");
    isSqlInjection("20*foobar  ()", "20*foobar  ()");
    isSqlInjection("!foobar()", "!foobar()");
    isSqlInjection("=foobar()", "=foobar()");
    isSqlInjection("1foobar()", "1foobar()");
    isSqlInjection("1foo_bar()", "1foo_bar()");
    isSqlInjection("1foo-bar()", "1foo-bar()");
    isSqlInjection("#foobar()", "#foobar()");

    isNotSqlInjection("foobar)", "foobar)");
    isNotSqlInjection("foobar      )", "foobar      )");
    isNotSqlInjection("€foobar()", "€foobar()");
  }
);

t.test(
  "It flags lowercased input as SQL injection",
  { skip: "memory leak" },
  async () => {
    isSqlInjection(
      `
      SELECT id,
               email,
               password_hash,
               registered_at,
               is_confirmed,
               first_name,
               last_name
        FROM users WHERE email_lowercase = '' or 1=1 -- a',
    `,
      "' OR 1=1 -- a"
    );
  }
);

t.test("It does not match VIEW keyword", { skip: "memory leak" }, async () => {
  const query = `
      SELECT views.id AS view_id, view_settings.user_id, view_settings.settings
        FROM views
        INNER JOIN view_settings ON views.id = view_settings.view_id AND view_settings.user_id = ?
        WHERE views.business_id = ?
    `;

  isNotSqlInjection(query, "view_id");
  isNotSqlInjection(query, "view_settings");
  isNotSqlInjection(query, "view_settings.user_id");

  const query2 = `
    SELECT id,
           business_id,
           object_type,
           name,
           \`condition\`,
           settings,
           \`read_only\`,
           created_at,
           updated_at
    FROM views
    WHERE business_id = ?
  `;

  isNotSqlInjection(query2, "view");
});

t.test("It does not match GROUP keyword", { skip: "memory leak" }, async () => {
  const query = `
      SELECT groups.id AS group_id, group_settings.user_id, group_settings.settings
        FROM groups
        INNER JOIN group_settings ON groups.id = group_settings.group_id AND group_settings.user_id = ?
        WHERE groups.business_id = ?
        GROUP BY group_id
        ORDER BY group_id DESC, group_settings.user_id ASC
    `;

  isNotSqlInjection(query, "group_id");
  isNotSqlInjection(query, "DESC");
  isNotSqlInjection(query, "ASC");
});

t.test(
  "It does not flag SQL keyword if part of another word",
  { skip: "memory leak" },
  async () => {
    SQL_KEYWORDS.forEach((keyword) => {
      isNotSqlInjection(
        `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${keyword}
        WHERE business_id = ?
    `,
        keyword
      );

      isNotSqlInjection(
        `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${keyword.toLowerCase()}
        WHERE business_id = ?
    `,
        keyword
      );
    });
  }
);

t.test(
  "It flags SQL keyword if it contains space",
  { skip: "memory leak" },
  async () => {
    SQL_KEYWORDS.forEach((keyword) => {
      isSqlInjection(
        `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${keyword}
        WHERE business_id = ?
    `,
        " " + keyword
      );

      isSqlInjection(
        `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${keyword}
        WHERE business_id = ?
    `,
        " " + keyword.toLowerCase()
      );
    });
  }
);

t.test(
  "It flags SQL keyword if it contains dangerous character",
  { skip: "memory leak" },
  async () => {
    SQL_KEYWORDS.forEach((keyword) => {
      SQL_DANGEROUS_IN_STRING.forEach((string) => {
        const payload = `${string}${keyword}`;
        isSqlInjection(
          `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${payload}
        WHERE business_id = ?
    `,
          payload
        );

        isSqlInjection(
          `
      SELECT id,
             business_id,
             name,
             created_at,
             updated_at
        FROM ${payload}
        WHERE business_id = ?
    `,
          payload.toLowerCase()
        );
      });
    });
  }
);

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
  join(__dirname, "payloads", "mssql_and_db2.txt"),
];

function escapeLikeDatabase(str: string, char: string) {
  // Replace all occurrences of the char with \\char
  // Replace all occurrences of \ with \\
  return (
    char +
    str.replace(
      new RegExp(`${char}|${escapeStringRegexp("\\")}`, "g"),
      "\\" + char
    ) +
    char
  );
}

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      { skip: "memory leak" },
      async () => {
        isSqlInjection(sql, sql);
      }
    );

    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection (in query)`,
      { skip: "memory leak" },
      async () => {
        isSqlInjection(`SELECT * FROM users WHERE id = ${sql}`, sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with single quotes using backslash)`,
      { skip: "memory leak" },
      async () => {
        const escaped = escapeLikeDatabase(sql, "'");
        isNotSqlInjection(`SELECT * FROM users WHERE id = ${escaped}`, sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with double quotes using backslash)`,
      { skip: "memory leak" },
      async () => {
        const escaped = escapeLikeDatabase(sql, '"');
        isNotSqlInjection(`SELECT * FROM users WHERE id = ${escaped}`, sql);
      }
    );
  }
}

function isSqlInjection(sql: string, input: string) {
  t.same(
    detectSQLInjection(sql, input, new SQLDialectMySQL()),
    true,
    `${sql} (mysql)`
  );
  t.same(
    detectSQLInjection(sql, input, new SQLDialectPostgres()),
    true,
    `${sql} (postgres)`
  );
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(
    detectSQLInjection(sql, input, new SQLDialectMySQL()),
    false,
    `${sql} (mysql)`
  );
  t.same(
    detectSQLInjection(sql, input, new SQLDialectPostgres()),
    false,
    `${sql} (postgres)`
  );
}
