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
