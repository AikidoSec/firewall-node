import { randomInt } from "crypto";
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

t.test("it returns false for empty string", async () => {
  t.same(looksLikeASecret(""), false);
});

t.test("it returns false for short strings", async () => {
  t.same(looksLikeASecret("c"), false);
  t.same(looksLikeASecret("NR"), false);
  t.same(looksLikeASecret("7t3"), false);
  t.same(looksLikeASecret("4qEK"), false);
  t.same(looksLikeASecret("KJr6s"), false);
  t.same(looksLikeASecret("KXiW4a"), false);
  t.same(looksLikeASecret("Fupm2Vi"), false);
  t.same(looksLikeASecret("jiGmyGfg"), false);
  t.same(looksLikeASecret("SJPLzVQ8t"), false);
  t.same(looksLikeASecret("OmNf04j6mU"), false);
});

t.test("it returns true for long strings", async () => {
  t.same(looksLikeASecret("rsVEExrR2sVDONyeWwND"), true);
  t.same(looksLikeASecret(":2fbg;:qf$BRBc<2AG8&"), true);
});

t.test("it flags very long strings", async () => {
  t.same(
    looksLikeASecret(
      "efDJHhzvkytpXoMkFUgag6shWJktYZ5QUrUCTfecFELpdvaoAT3tekI4ZhpzbqLt"
    ),
    true
  );
});

t.test("it flags very very long strings", async () => {
  t.same(
    looksLikeASecret(
      "XqSwF6ySwMdTomIdmgFWcMVXWf5L0oVvO5sIjaCPI7EjiPvRZhZGWx3A6mLl1HXPOHdUeabsjhngW06JiLhAchFwgtUaAYXLolZn75WsJVKHxEM1mEXhlmZepLCGwRAM"
    ),
    true
  );
});

t.test("it returns false if contains white space", async () => {
  t.same(looksLikeASecret("rsVEExrR2sVDONyeWwND "), false);
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
  "subscriptions",
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
  "jenkinsFile",
  "ConnectionStrings.config",
  "coach",
  "login",
  "payment_methods",
  "activity_logs",
  "feedback_responses",
  "balance_transactions",
  "customer_sessions",
  "payment_intents",
  "billing_portal",
  "subscription_items",
  "namedLayouts",
  "PlatformAction",
  "quickActions",
  "queryLocator",
  "relevantItems",
  "parameterizedSearch",
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
  "AG7DrGi3pDDIUU1PrEsj",
  "CnJ4DunhYfv2db6T1FRfciRBHtlNKOYrjoz",
  "Gic*EfMq:^MQ|ZcmX:yW1",
  "AG7DrGi3pDDIUU1PrEsj",
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
