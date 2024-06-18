import { randomInt } from "node:crypto";
import * as t from "tap";
import { looksLikeASecret } from "./looksLikeASecret";

const lower = "abcdefghijklmnopqrstuvwxyz";
const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const numbers = "0123456789";
const specials = "!#$%^&*|;:<>";

function secretFromCharset(length: number, charset: string) {
  return Array.from({ length })
    .map(() => charset[randomInt(0, charset.length - 1)])
    .join("");
}

t.test("it returns false for short strings", async () => {
  for (let length = 1; length <= 10; length++) {
    const secret = secretFromCharset(length, lower + upper + numbers);
    t.same(
      looksLikeASecret(secret),
      false,
      `Expected string of length ${length} to not look like a secret: ${secret}`
    );
  }
});

t.test("it returns true for long strings", async () => {
  const secret = secretFromCharset(20, lower + upper + numbers);
  t.same(
    looksLikeASecret(secret),
    true,
    `Expected string to look like a secret: ${secret}`
  );

  const secret2 = secretFromCharset(20, lower + upper + numbers + specials);
  t.same(
    looksLikeASecret(secret2),
    true,
    `Expected string to look like a secret: ${secret2}`
  );
});

t.test("it flags very long strings", async () => {
  const secret = secretFromCharset(64, lower + upper + numbers);
  t.same(
    looksLikeASecret(secret),
    true,
    `Expected string to not look like a secret: ${secret}`
  );
});

t.test("it flags very very long strings", async () => {
  const secret = secretFromCharset(128, lower + upper + numbers);
  t.same(
    looksLikeASecret(secret),
    true,
    `Expected string to not look like a secret: ${secret}`
  );
});

t.test("it returns false if contains white space", async () => {
  t.same(
    looksLikeASecret(secretFromCharset(10, lower + upper + numbers) + " "),
    false
  );
});

t.test("it returns false if it has less than 2 charsets", async () => {
  t.same(looksLikeASecret(secretFromCharset(10, lower)), false);
  t.same(looksLikeASecret(secretFromCharset(10, upper)), false);
  t.same(looksLikeASecret(secretFromCharset(10, numbers)), false);
  t.same(looksLikeASecret(secretFromCharset(10, specials)), false);
});

const urlTerms = [
  "development",
  "programming",
  "applications",
  "implementation",
  "environment",
  "technologies",
  "documentation",
  "demonstration",
  "configuration",
  "administrator",
  "visualization",
  "international",
  "collaboration",
  "opportunities",
  "functionality",
  "customization",
  "specifications",
  "optimization",
  "contributions",
  "accessibility",
  "subscription",
  "infrastructure",
  "architecture",
  "authentication",
  "sustainability",
  "notifications",
  "announcements",
  "recommendations",
  "communication",
  "compatibility",
  "enhancement",
  "integration",
  "performance",
  "improvements",
  "introduction",
  "capabilities",
  "communities",
  "credentials",
  "integration",
  "permissions",
  "validation",
  "serialization",
  "deserialization",
  "rate-limiting",
  "throttling",
  "load-balancer",
  "microservices",
  "endpoints",
  "data-transfer",
  "encryption",
  "authorization",
  "bearer-token",
  "multipart",
  "urlencoded",
  "api-docs",
  "postman",
  "json-schema",
  "serialization",
  "deserialization",
  "rate-limiting",
  "throttling",
  "load-balancer",
  "api-gateway",
  "microservices",
  "endpoints",
  "data-transfer",
  "encryption",
  "signature",
  "poppins-bold-webfont.woff2",
  "karla-bold-webfont.woff2",
  "startEmailBasedLogin",
];

t.test("it returns false for common url terms", async () => {
  for (const term of urlTerms) {
    t.same(
      looksLikeASecret(term),
      false,
      `Expected ${term} to not look like a secret`
    );
  }
});

t.test("it returns false for known word separators", async () => {
  t.same(looksLikeASecret("this-is-a-secret-1"), false);
});

t.test("a number is not a secret", async () => {
  t.same(looksLikeASecret("1234567890"), false);
  t.same(looksLikeASecret("1234567890".repeat(2)), false);
});

const secrets = [
  "yqHYTS<agpi^aa1",
  "hIofuWBifkJI5iVsSNKKKDpBfmMqJJwuXMxau6AS8WZaHVLDAMeJXo3BwsFyrIIm",
];

t.test("it returns true for known secrets", async () => {
  for (const secret of secrets) {
    t.same(
      looksLikeASecret(secret),
      true,
      `Expected ${secret} to look like a secret`
    );
  }
});
