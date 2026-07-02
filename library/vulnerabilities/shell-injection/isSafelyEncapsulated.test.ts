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

t.test("user input is substring of single-quoted content", async () => {
  t.same(isSafelyEncapsulated("ls '/var/a b/c'", "a b"), true);
  t.same(
    isSafelyEncapsulated("grep 'hello world' file.txt", "hello world"),
    true
  );
  t.same(isSafelyEncapsulated("echo 'prefix foo suffix'", "foo"), true);
});

t.test(
  "user input is substring of double-quoted content without dangerous chars",
  async () => {
    t.same(isSafelyEncapsulated(`ls "/var/a b/c"`, "a b"), true);
    t.same(
      isSafelyEncapsulated(`grep "hello world" file.txt`, "hello world"),
      true
    );
  }
);

t.test(
  "user input is substring of double-quoted content with dangerous chars",
  async () => {
    t.same(isSafelyEncapsulated(`echo "/tmp/$USER/dir"`, "$USER"), false);
    t.same(isSafelyEncapsulated('echo "/tmp/`whoami`/dir"', "`whoami`"), false);
  }
);

t.test("user input spans across quote boundary", async () => {
  t.same(isSafelyEncapsulated("echo 'hello' world", "lo' wo"), false);
  t.same(isSafelyEncapsulated(`echo "hello" world`, `lo" wo`), false);
});

t.test("user input is the entire quoted content", async () => {
  t.same(isSafelyEncapsulated("echo 'hello'", "hello"), true);
  t.same(isSafelyEncapsulated(`echo "hello"`, "hello"), true);
});

t.test("unterminated quotes", async () => {
  t.same(isSafelyEncapsulated("echo 'hello", "hello"), false);
  t.same(isSafelyEncapsulated(`echo "hello`, "hello"), false);
});

t.test("single quotes inside double quotes are literal", async () => {
  t.same(isSafelyEncapsulated(`echo "it's fine"`, "it's fine"), true);
});

t.test("double quotes inside single quotes are literal", async () => {
  t.same(isSafelyEncapsulated(`echo 'say "hi"'`, `say "hi"`), true);
});

t.test("escaped double quote inside double quotes", async () => {
  t.same(isSafelyEncapsulated(`echo "hello \\"world\\""`, "hello"), true);
});

t.test("user input appears both inside and outside quotes", async () => {
  t.same(isSafelyEncapsulated("echo 'foo' foo", "foo"), false);
});

t.test("multiple safe occurrences in different quote types", async () => {
  t.same(isSafelyEncapsulated(`echo 'foo' "foo"`, "foo"), true);
});
