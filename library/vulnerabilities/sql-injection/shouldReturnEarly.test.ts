import * as t from "tap";
import { shouldReturnEarly } from "./shouldReturnEarly";

t.test("should return early - true cases", async (t) => {
  // User input is empty
  t.equal(shouldReturnEarly("SELECT * FROM users", ""), true);

  // User input is a single character
  t.equal(shouldReturnEarly("SELECT * FROM users", "a"), true);

  // User input is larger than query
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users",
      "SELECT * FROM users WHERE id = 1"
    ),
    true
  );

  // User input not in query
  t.equal(shouldReturnEarly("SELECT * FROM users", "DELETE"), true);

  // User input is alphanumerical
  t.equal(shouldReturnEarly("SELECT * FROM users123", "users123"), true);
  t.equal(shouldReturnEarly("SELECT * FROM users_123", "users_123"), true);
  t.equal(shouldReturnEarly("SELECT __1 FROM users_123", "__1"), true);
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM table_name_is_fun_12",
      "table_name_is_fun_12"
    ),
    true
  );

  // User input is a valid comma-separated number list
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (1,2,3)", "1,2,3"),
    true
  );

  // User input is a valid number
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (123)", "123"),
    true
  );

  // User input is a valid number with spaces
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (  123  )", "  123  "),
    true
  );

  // User input is a valid number with commas
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (1, 2, 3)", "1, 2, 3"),
    true
  );

  // User input is a valid number with decimals
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (123.45)", "123.45"),
    true
  );
  // Version number
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users WHERE test IN (123.45.56)",
      "123.45.56"
    ),
    true
  );
});

t.test("should return early - false cases", async (t) => {
  // User input is in query
  t.equal(shouldReturnEarly("SELECT * FROM users", " users"), false);

  // User input is a valid string in query
  t.equal(shouldReturnEarly("SELECT * FROM users", "SELECT "), false);

  // User input is a valid string in query with special characters
  t.equal(
    shouldReturnEarly("SELECT * FROM users; DROP TABLE", "users; DROP TABLE"),
    false
  );

  // User input is a number with injection
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users WHERE test IN (123); DROP TABLE -- );",
      "123); DROP TABLE -- "
    ),
    false
  );

  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (a.b);", "a.b"),
    false
  );
  t.equal(
    shouldReturnEarly("SELECT * FROM users WHERE test IN (1.b);", "1.b"),
    false
  );
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users WHERE test IN (1, 2, a);",
      "1, 2, a"
    ),
    false
  );
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users WHERE test IN (1, 2, 3..a);",
      "1, 2, 3..a"
    ),
    false
  );
  t.equal(
    shouldReturnEarly(
      "SELECT * FROM users WHERE test IN (1, 2, 3.8..7);",
      "1, 2, 3.8..7"
    ),
    false
  );
  t.equal(
    shouldReturnEarly(
      "SELECT (ARRAY[10,20,30,40,50])[2..4] AS slice_dots;",
      "2..4"
    ),
    false
  );

  // Ignores really large input
  t.equal(
    shouldReturnEarly(
      `SELECT * FROM users WHERE test IN (${"1,2,".repeat(10_000)}2);`,
      `${"1,2,".repeat(10_000)}2`
    ),
    false
  );
});
