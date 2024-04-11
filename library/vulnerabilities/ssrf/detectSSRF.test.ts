import * as t from "tap";
import { detectSSRF } from "./detectSSRF";

t.test("returns false if user input and hostname are empty", async (t) => {
  t.same(detectSSRF("", ""), false);
});

t.test("returns false if user input is empty", async (t) => {
  t.same(detectSSRF("", "example.com"), false);
});

t.test("returns false if hostname is empty", async (t) => {
  t.same(detectSSRF("http://example.com", ""), false);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(detectSSRF("http://localhost", "localhost"), true);
});

t.test("it parses hostname from user input", async (t) => {
  t.same(detectSSRF("localhost", "localhost"), true);
});

t.test("it ignores invalid URLs", async (t) => {
  t.same(detectSSRF("http://", "localhost"), false);
});

t.test("it checks for private IP addresses", async (t) => {
  t.same(detectSSRF("http://10.0.0.1", "10.0.0.1"), true);
});

t.test("it checks for private IP addresses", async (t) => {
  t.same(detectSSRF("http://74.125.133.99", "74.125.133.99"), false);
});
