import * as t from "tap";
import { normalizeHostname } from "./normalizeHostname";

t.test("strips trailing dot", async (t) => {
  t.same(normalizeHostname("example.com."), "example.com");
  t.same(normalizeHostname("sub.example.com."), "sub.example.com");
  t.same(normalizeHostname("localhost."), "localhost");
});

t.test("leaves normal hostnames unchanged", async (t) => {
  t.same(normalizeHostname("example.com"), "example.com");
  t.same(normalizeHostname("localhost"), "localhost");
  t.same(normalizeHostname("192.168.1.1"), "192.168.1.1");
  t.same(normalizeHostname(""), "");
});
