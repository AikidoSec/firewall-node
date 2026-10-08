import * as t from "tap";
import { extractSQLFromObject } from "./extractSQLFromObject";
import { SQLDialectPostgres } from "../../vulnerabilities/sql-injection/dialects/SQLDialectPostgres";
import { SQLDialectGeneric } from "../../vulnerabilities/sql-injection/dialects/SQLDialectGeneric";
import { SQLDialectSQLite } from "../../vulnerabilities/sql-injection/dialects/SQLDialectSQLite";

t.test("extractSQLFromArgs - string argument", async (t) => {
  const sql = "SELECT * FROM users WHERE id = 1";
  const result = extractSQLFromObject([sql], new SQLDialectGeneric());
  t.equal(result, sql);
});

t.test("extractSQLFromArgs - empty args", async (t) => {
  const result = extractSQLFromObject([], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - empty string argument", async (t) => {
  const result = extractSQLFromObject([""], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - unsupported first argument", async (t) => {
  const result = extractSQLFromObject([123], new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test(
  "extractSQLFromArgs - tagged template with generic dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ""],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users WHERE id = ? AND role = ?");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with postgres dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ""],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectPostgres());
    t.equal(result, "SELECT * FROM users WHERE id = $1 AND role = $2");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with postgres dialect with semicolon",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", " AND role = ", ";"],
      values: [1, "admin"],
    };

    const result = extractSQLFromObject(template, new SQLDialectPostgres());
    t.equal(result, "SELECT * FROM users WHERE id = $1 AND role = $2;");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with sqlite dialect",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ""],
      values: [1],
    };

    const result = extractSQLFromObject(template, new SQLDialectSQLite());
    t.equal(result, "SELECT * FROM users WHERE id = ?");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with sqlite dialect with empty values",
  async (t) => {
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ";"],
      values: [],
    };

    const result = extractSQLFromObject(template, new SQLDialectSQLite());
    t.equal(result, "SELECT * FROM users WHERE id = ;");
  }
);

t.test("extractSQLFromArgs - invalid template strings", async (t) => {
  const invalidTemplate = {
    strings: ["SELECT * FROM users WHERE id = ", 123],
    values: [1],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - invalid template missing values", async (t) => {
  const invalidTemplate = {
    strings: ["SELECT * FROM users"],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test("extractSQLFromArgs - invalid template empty strings", async (t) => {
  const invalidTemplate = {
    strings: [],
    values: [],
  };

  const result = extractSQLFromObject(invalidTemplate, new SQLDialectGeneric());
  t.equal(result, undefined);
});

t.test(
  "extractSQLFromArgs - tagged template with nested raw fragment",
  async (t) => {
    // Simulates: $queryRaw`SELECT * FROM users WHERE id = ${1}; ${Prisma.raw("-- comment")}`
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", "; ", ""],
      values: [
        1,
        {
          strings: ["-- comment"],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users WHERE id = ?; -- comment");
  }
);

t.test(
  "extractSQLFromArgs - tagged template with nested raw fragment (postgres)",
  async (t) => {
    // Simulates: $queryRaw`SELECT * FROM users WHERE id = ${1}; ${Prisma.raw("-- comment")}`
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", "; ", ""],
      values: [
        1,
        {
          strings: ["-- comment"],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectPostgres());
    t.equal(result, "SELECT * FROM users WHERE id = $1; -- comment");
  }
);

t.test(
  "extractSQLFromArgs - standalone raw fragment",
  async (t) => {
    // Simulates: $queryRaw(Prisma.raw("SELECT * FROM users"))
    const rawFragment = {
      strings: ["SELECT * FROM users"],
      values: [],
    };

    const result = extractSQLFromObject(rawFragment, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users");
  }
);

t.test(
  "extractSQLFromArgs - nested raw fragment with SQL injection pattern",
  async (t) => {
    // Simulates: $queryRaw`SELECT * FROM users; ${Prisma.raw("DROP TABLE users;--")}`
    const template = {
      strings: ["SELECT * FROM users; ", ""],
      values: [
        {
          strings: ["DROP TABLE users;--"],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users; DROP TABLE users;--");
  }
);

t.test(
  "extractSQLFromArgs - multiple nested raw fragments",
  async (t) => {
    // Simulates: $queryRaw`SELECT * FROM ${Prisma.raw("users")} WHERE id = ${1} AND ${Prisma.raw("active = 1")}`
    const template = {
      strings: ["SELECT * FROM ", " WHERE id = ", " AND ", ""],
      values: [
        {
          strings: ["users"],
          values: [],
        },
        1,
        {
          strings: ["active = 1"],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    t.equal(result, "SELECT * FROM users WHERE id = ? AND active = 1");
  }
);

// Security-focused tests to verify the pentest finding is mitigated

t.test(
  "SECURITY: nested raw fragment with SQL injection payload is extracted",
  async (t) => {
    // This test verifies that attacker-controlled SQL in Prisma.raw() is now
    // included in the extracted SQL, so it can be detected by SQL injection checks.
    // Before the fix, this would have been replaced with a placeholder and the
    // malicious SQL would bypass detection.
    
    // Simulates: $queryRaw`SELECT * FROM users WHERE id = ${Prisma.raw(userInput)}`
    // where userInput = "1 OR 1=1; --"
    const maliciousPayload = "1 OR 1=1; --";
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ""],
      values: [
        {
          strings: [maliciousPayload],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    // The extracted SQL MUST contain the malicious payload for detection to work
    t.ok(result, "SQL should be extracted");
    t.ok(
      result!.includes(maliciousPayload),
      "Extracted SQL must contain the nested raw fragment content for SQL injection detection"
    );
    t.equal(result, "SELECT * FROM users WHERE id = 1 OR 1=1; --");
  }
);

t.test(
  "SECURITY: nested raw fragment with UNION injection is extracted",
  async (t) => {
    // Verifies UNION-based SQL injection payloads in nested raw fragments are extracted
    const unionPayload = "1 UNION SELECT password FROM admin_users--";
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ""],
      values: [
        {
          strings: [unionPayload],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    t.ok(
      result!.includes("UNION"),
      "UNION keyword from nested raw fragment must be in extracted SQL"
    );
    t.ok(
      result!.includes(unionPayload),
      "Full UNION injection payload must be extracted"
    );
  }
);

t.test(
  "SECURITY: nested raw fragment with DROP TABLE is extracted",
  async (t) => {
    // Verifies destructive SQL commands in nested raw fragments are extracted
    const dropPayload = "1; DROP TABLE users; --";
    const template = {
      strings: ["SELECT * FROM users WHERE id = ", ""],
      values: [
        {
          strings: [dropPayload],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    t.ok(
      result!.includes("DROP TABLE"),
      "DROP TABLE command from nested raw fragment must be in extracted SQL"
    );
    t.equal(result, "SELECT * FROM users WHERE id = 1; DROP TABLE users; --");
  }
);

t.test(
  "SECURITY: deeply nested raw fragments are fully extracted",
  async (t) => {
    // Verifies that even deeply nested raw fragments (raw within raw) are extracted
    // This ensures the recursive extraction works correctly
    const innerRawFragment = {
      strings: ["malicious_column"],
      values: [],
    };
    
    const outerRawFragment = {
      strings: ["SELECT ", " FROM users"],
      values: [innerRawFragment],
    };
    
    const template = {
      strings: ["", " WHERE id = ", ""],
      values: [outerRawFragment, 1],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    t.ok(
      result!.includes("malicious_column"),
      "Deeply nested content must be extracted"
    );
    t.equal(result, "SELECT malicious_column FROM users WHERE id = ?");
  }
);

t.test(
  "SECURITY: mixed regular values and raw fragments are handled correctly",
  async (t) => {
    // Verifies that when both regular values and raw fragments are present,
    // regular values get placeholders and raw fragments get their SQL extracted
    const template = {
      strings: ["SELECT * FROM ", " WHERE id = ", " AND status = ", ""],
      values: [
        {
          strings: ["users; DROP TABLE sessions; --"],
          values: [],
        },
        123, // regular value - should become placeholder
        "active", // regular value - should become placeholder
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    // The malicious SQL from the raw fragment must be present
    t.ok(
      result!.includes("DROP TABLE sessions"),
      "Malicious SQL from raw fragment must be extracted"
    );
    // Regular values should be replaced with placeholders
    t.notOk(
      result!.includes("123"),
      "Regular numeric value should be replaced with placeholder"
    );
    t.notOk(
      result!.includes("active"),
      "Regular string value should be replaced with placeholder"
    );
    t.equal(
      result,
      "SELECT * FROM users; DROP TABLE sessions; -- WHERE id = ? AND status = ?"
    );
  }
);

t.test(
  "SECURITY: empty nested raw fragment does not bypass detection",
  async (t) => {
    // Verifies that empty raw fragments don't cause issues
    const template = {
      strings: ["SELECT * FROM users WHERE ", ""],
      values: [
        {
          strings: [""],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted even with empty raw fragment");
    t.equal(result, "SELECT * FROM users WHERE ");
  }
);

t.test(
  "SECURITY: raw fragment with only whitespace is extracted",
  async (t) => {
    // Verifies that whitespace-only raw fragments are handled correctly
    const template = {
      strings: ["SELECT * FROM users WHERE", "id = 1"],
      values: [
        {
          strings: ["   "],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    t.equal(result, "SELECT * FROM users WHERE   id = 1");
  }
);

t.test(
  "SECURITY: multiple malicious raw fragments are all extracted",
  async (t) => {
    // Verifies that when multiple raw fragments contain malicious SQL,
    // all of them are extracted for detection
    const template = {
      strings: ["SELECT * FROM ", " WHERE ", " OR ", ""],
      values: [
        {
          strings: ["users; DROP TABLE logs; --"],
          values: [],
        },
        {
          strings: ["id = 1"],
          values: [],
        },
        {
          strings: ["1=1; DELETE FROM sessions; --"],
          values: [],
        },
      ],
    };

    const result = extractSQLFromObject(template, new SQLDialectGeneric());
    
    t.ok(result, "SQL should be extracted");
    t.ok(
      result!.includes("DROP TABLE logs"),
      "First malicious payload must be extracted"
    );
    t.ok(
      result!.includes("DELETE FROM sessions"),
      "Second malicious payload must be extracted"
    );
    t.equal(
      result,
      "SELECT * FROM users; DROP TABLE logs; -- WHERE id = 1 OR 1=1; DELETE FROM sessions; --"
    );
  }
);
