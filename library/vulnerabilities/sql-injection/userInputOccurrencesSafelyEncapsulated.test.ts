import * as t from "tap";
import { userInputOccurrencesSafelyEncapsulated } from "./userInputOccurrencesSafelyEncapsulated";

t.test(
  "Test the userInputOccurrencesSafelyEncapsulated() function",
  async () => {
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        ` Hello Hello 'UNION'and also "UNION" `,
        "UNION"
      ),
      true
    );
    t.same(userInputOccurrencesSafelyEncapsulated(`"UNION"`, "UNION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated("`UNION`", "UNION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated("`U`NION`", "U`NION"), false);
    t.same(userInputOccurrencesSafelyEncapsulated(` 'UNION' `, "UNION"), true);
    t.same(
      userInputOccurrencesSafelyEncapsulated(`"UNION"'UNION'`, "UNION"),
      true
    );

    t.same(
      userInputOccurrencesSafelyEncapsulated(`'UNION'"UNION"UNION`, "UNION"),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(`'UNION'UNION"UNION"`, "UNION"),
      false
    );
    t.same(userInputOccurrencesSafelyEncapsulated("UNION", "UNION"), false);
    t.same(userInputOccurrencesSafelyEncapsulated(`"UN'ION"`, "UN'ION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated(`'UN"ION'`, 'UN"ION'), true);
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UN"ION' AND id = "UN'ION"`,
        'UN"ION'
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UN'ION' AND id = "UN'ION"`,
        `UN'ION`
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\'`,
        "UNION\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\\\'`,
        "UNION\\\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\\\\\'`,
        "UNION\\\\\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\n'`,
        "UNION\\n"
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM users WHERE id = '\\'hello'`,
        "'hello'"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM users WHERE id = "\\"hello"`,
        '"hello"'
      ),
      false
    );
  }
);

t.test("surrounded with single quotes", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = '\\'hello\\''`,
      "'hello'"
    ),
    true
  );
});

t.test("surrounded with double quotes", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = "\\"hello\\""`,
      '"hello"'
    ),
    true
  );
});

t.test("starts with single quote", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = '\\' or true--'`,
      "' or true--"
    ),
    true
  );
});

t.test("starts with double quote", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = "\\" or true--"`,
      '" or true--'
    ),
    true
  );
});

t.test("starts with single quote without SQL syntax", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = '\\' hello world'`,
      "' hello world"
    ),
    true
  );
});

t.test("starts with double quote without SQL syntax", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = "\\" hello world"`,
      '" hello world'
    ),
    true
  );
});

t.test("starts with single quote (multiple occurrences)", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = '\\'hello' AND id = '\\'hello'`,
      "'hello"
    ),
    true
  );
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = 'hello' AND id = '\\'hello'`,
      "'hello"
    ),
    false
  );
});

t.test("starts with double quote (multiple occurrences)", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = "\\"hello" AND id = "\\"hello"`,
      '"hello'
    ),
    true
  );
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = "hello" AND id = "\\"hello"`,
      '"hello'
    ),
    false
  );
});

t.test("single quotes escaped with single quotes", async () => {
  t.same(
    userInputOccurrencesSafelyEncapsulated(
      `SELECT * FROM users WHERE id = '''&'''`,
      "'&'"
    ),
    false
  );
});
