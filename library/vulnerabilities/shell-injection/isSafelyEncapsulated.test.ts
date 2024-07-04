import * as t from "tap";
import { isSafelyEncapsulated } from "./isSafelyEncapsulated";

t.test("safe between single quotes", async (t) => {
  t.same(isSafelyEncapsulated("echo '$USER'", "$USER"), true);
  t.same(isSafelyEncapsulated("echo '`$USER'", "`USER"), true);
});

t.test("single quote in single quotes", async () => {
  t.same(isSafelyEncapsulated("echo ''USER'", "'USER"), false);
});

t.test("dangerous chars between double quotes", async () => {
  t.same(isSafelyEncapsulated(`echo "=USER"`, "=USER"), true);

  t.same(isSafelyEncapsulated(`echo "$USER"`, "$USER"), false);
  t.same(isSafelyEncapsulated(`echo "!USER"`, "!USER"), false);
  t.same(isSafelyEncapsulated(`echo "\`USER"`, "`USER"), false);
  t.same(isSafelyEncapsulated(`echo "\\USER"`, "\\USER"), false);
});

t.test("same user input multiple times", async () => {
  t.same(isSafelyEncapsulated(`echo '$USER' '$USER'`, "$USER"), true);

  t.same(isSafelyEncapsulated(`echo "$USER" '$USER'`, "$USER"), false);
  t.same(isSafelyEncapsulated(`echo "$USER" "$USER"`, "$USER"), false);
});

t.test("the first and last quote doesn't match", async () => {
  t.same(isSafelyEncapsulated(`echo '$USER"`, "$USER"), false);
  t.same(isSafelyEncapsulated(`echo "$USER'`, "$USER"), false);
});

t.test("the first or last character is not an escape char", async () => {
  t.same(isSafelyEncapsulated(`echo $USER'`, "$USER"), false);
  t.same(isSafelyEncapsulated(`echo $USER"`, "$USER"), false);
});

t.test("user input does not occur in the command", async () => {
  t.same(isSafelyEncapsulated(`echo 'USER'`, "$USER"), true);
  t.same(isSafelyEncapsulated(`echo "USER"`, "$USER"), true);
});

// The following tests look at the case where the user input is encapsulated in both single and double quotes.
// This can lead to a bypass of the shell injection detection, because the user input can be executed as a command.
t.test("use both single and double quotes and is not safe", async () => {
  t.same(
    isSafelyEncapsulated(`echo "Your value here: '" ; id #'"`, `" ; id #`),
    false
  );
  t.same(
    isSafelyEncapsulated(`echo "Your value here: '";id #'"`, `";id #`),
    false
  );
  t.same(
    isSafelyEncapsulated(`echo "Your value here: '" ; id #"'"`, `" ; id #"`),
    false
  );
  t.same(
    isSafelyEncapsulated(`echo 'Your value here: "' ; id #"'`, `' ; id #`),
    false
  );
  t.same(
    isSafelyEncapsulated(
      `echo 'Your value here: "test' ; id #123"'`,
      `test' ; id #123`
    ),
    false
  );
});

t.test("use both single and double quotes and is safe", async () => {
  t.same(
    isSafelyEncapsulated(`echo "Your value here: '"" ; id #'"`, `"" ; id #`),
    true
  );
});
