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

t.test("quote adjacency does not imply encapsulation", async () => {
  // The vulnerability case: quotes adjacent to user input don't mean it's encapsulated
  t.same(isSafelyEncapsulated("echo 'prefix';id;'suffix'", ";id;"), false);
  t.same(isSafelyEncapsulated("echo 'prefix';whoami;'suffix'", ";whoami;"), false);
  t.same(isSafelyEncapsulated(`echo "prefix";id;"suffix"`, ";id;"), false);
});

t.test("pentest finding: quote adjacency bypass variations", async () => {
  // Core vulnerability: adjacent quotes closing/opening around payload
  t.same(isSafelyEncapsulated("echo 'a'; rm -rf /; 'b'", "; rm -rf /; "), false);
  t.same(isSafelyEncapsulated("cat 'file1';cat /etc/passwd;'file2'", ";cat /etc/passwd;"), false);
  
  // Multiple command separators
  t.same(isSafelyEncapsulated("echo 'x'&&id&&'y'", "&&id&&"), false);
  t.same(isSafelyEncapsulated("echo 'x'||whoami||'y'", "||whoami||"), false);
  t.same(isSafelyEncapsulated("echo 'x'|id|'y'", "|id|"), false);
  
  // Mixed quote types
  t.same(isSafelyEncapsulated(`echo "prefix";id;'suffix'`, ";id;"), false);
  t.same(isSafelyEncapsulated(`echo 'prefix';id;"suffix"`, ";id;"), false);
  
  // Nested/complex cases
  t.same(isSafelyEncapsulated("echo 'a';echo 'b';id;'c'", ";echo 'b';id;"), false);
  t.same(isSafelyEncapsulated("cmd 'arg1';malicious;'arg2' 'arg3'", ";malicious;"), false);
});

t.test("properly encapsulated input remains safe", async () => {
  // These should still be detected as safe (true) - input is actually inside quotes
  t.same(isSafelyEncapsulated("echo ';id;'", ";id;"), true);
  t.same(isSafelyEncapsulated(`echo ";id;"`, ";id;"), true);
  t.same(isSafelyEncapsulated("echo 'prefix;id;suffix'", ";id;"), true);
  t.same(isSafelyEncapsulated(`echo "prefix;id;suffix"`, ";id;"), true);
  
  // Multiple occurrences, all properly encapsulated
  t.same(isSafelyEncapsulated("echo ';id;' ';id;'", ";id;"), true);
  t.same(isSafelyEncapsulated(`echo ";id;" ";id;"`, ";id;"), true);
});

t.test("escaped quotes do not affect encapsulation detection", async () => {
  // Backslash escaping in double quotes
  t.same(isSafelyEncapsulated(`echo "test\\\\";id;"`, ";id;"), false);
  
  // Single quotes don't support escaping, so backslash is literal
  t.same(isSafelyEncapsulated("echo 'test\\';id;'", ";id;"), false);
});

t.test("quote state tracking across complex commands", async () => {
  // Verify quote state is properly tracked through the entire command
  t.same(isSafelyEncapsulated(`echo "a" 'b' "c";id;"d"`, ";id;"), false);
  t.same(isSafelyEncapsulated(`echo 'a' "b" 'c';id;'d'`, ";id;"), false);
  
  // Input at different positions
  t.same(isSafelyEncapsulated(`;id;echo 'suffix'`, ";id;"), false);
  t.same(isSafelyEncapsulated(`echo 'prefix';id;`, ";id;"), false);
});
