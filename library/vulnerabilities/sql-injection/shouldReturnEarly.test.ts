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
  t.equal(shouldReturnEarly("SELECT * FROM users", "1,2,3"), true);

  // User input is a valid number
  t.equal(shouldReturnEarly("SELECT * FROM users", "123"), true);

  // User input is a valid number with spaces
  t.equal(shouldReturnEarly("SELECT * FROM users", "  123  "), true);

  // User input is a valid number with commas
  t.equal(shouldReturnEarly("SELECT * FROM users", "1, 2, 3"), true);
});

t.test("should return early - false cases", async (t) => {
  // User input is in query
  t.equal(shouldReturnEarly("SELECT * FROM users", " users"), false);

  // User input is a valid string in query
  t.equal(shouldReturnEarly("SELECT * FROM users", "SELECT "), false);

  // User input is a valid string in query with different case
  t.equal(shouldReturnEarly("SELECT * FROM users", "select "), false);

  // User input is a valid string in query with mixed case
  t.equal(shouldReturnEarly("SELECT * FROM users", " UsErS"), false);

  // User input is a valid string in query with special characters
  t.equal(
    shouldReturnEarly("SELECT * FROM users; drop table", "users; DROP TABLE"),
    false
  );
});
