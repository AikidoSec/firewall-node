import * as t from "tap";
import { parse } from "./parseCookies";

t.test("should parse cookie string to object", async () => {
  t.match(parse("foo=bar"), { foo: "bar" });
  t.match(parse("foo=123"), { foo: "123" });
});

t.test("should ignore OWS", async () => {
  t.match(parse("FOO    = bar;   baz  =   raz"), {
    FOO: "bar",
    baz: "raz",
  });
});

t.test("should parse cookie with empty value", async () => {
  t.match(parse("foo= ; bar="), { foo: "", bar: "" });
});

t.test("should URL-decode values", async () => {
  t.match(parse('foo="bar=123456789&name=Magic+Mouse"'), {
    foo: "bar=123456789&name=Magic+Mouse",
  });

  t.match(parse("email=%20%22%2c%3b%2f"), { email: ' ",;/' });
});

t.test("should return original value on escape error", async () => {
  t.match(parse("foo=%1;bar=bar"), { foo: "%1", bar: "bar" });
});

t.test("should ignore cookies without value", async () => {
  t.match(parse("foo=bar;fizz  ;  buzz"), { foo: "bar" });
  t.match(parse("  fizz; foo=  bar"), { foo: "bar" });
});

t.test("should ignore duplicate cookies", async () => {
  t.match(parse("foo=%1;bar=bar;foo=boo"), {
    foo: "%1",
    bar: "bar",
  });
  t.match(parse("foo=false;bar=bar;foo=true"), {
    foo: "false",
    bar: "bar",
  });
  t.match(parse("foo=;bar=bar;foo=boo"), {
    foo: "",
    bar: "bar",
  });
});
