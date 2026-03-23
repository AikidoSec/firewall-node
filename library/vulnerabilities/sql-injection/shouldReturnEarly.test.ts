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

  // User input is a comma-separated number list
  t.equal(shouldReturnEarly("SELECT * WHERE id IN (1,2,3)", "1,2,3"), true);
  t.equal(shouldReturnEarly("SELECT * WHERE id IN (1, 2, 3)", "1, 2, 3"), true);

  // User input is a single number
  t.equal(shouldReturnEarly("SELECT * WHERE id = 123", "123"), true);

  // User input is a number with surrounding spaces
  t.equal(shouldReturnEarly("SELECT * WHERE id =   123  ", "  123  "), true);

  // User input has leading/trailing spaces
  t.equal(
    shouldReturnEarly("SELECT * WHERE id IN ( 1, 2, 3 )", " 1, 2, 3 "),
    true
  );

  // User input has multiple spaces between numbers
  t.equal(shouldReturnEarly("SELECT * WHERE id IN (1,  2)", "1,  2"), true);

  // User input has extra commas but contains digits
  t.equal(shouldReturnEarly("SELECT * WHERE id IN (,1,,)", ",1,,"), true);

  // User input is only commas (no digits)
  t.equal(shouldReturnEarly("SELECT ,, FROM users", ",,"), false);
  t.equal(shouldReturnEarly("SELECT ,,, FROM users", ",,,"), false);

  // User input is only spaces (no digits)
  t.equal(shouldReturnEarly("SELECT    FROM users", "  "), false);

  // User input contains a newline (not a valid number list)
  t.equal(shouldReturnEarly("SELECT * WHERE id IN (1,\n2)", "1,\n2"), false);
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
});
