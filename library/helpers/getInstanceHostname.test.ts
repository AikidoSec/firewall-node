import * as t from "tap";
import { hostname } from "os";
import { getInstanceHostname } from "./getInstanceHostname";

t.test("it returns the OS hostname by default", async (t) => {
  t.equal(getInstanceHostname(), hostname() || "");
});

t.test("it prefers AIKIDO_INSTANCE_NAME when set", async (t) => {
  process.env.AIKIDO_INSTANCE_NAME = "my-instance";
  t.equal(getInstanceHostname(), "my-instance");
  delete process.env.AIKIDO_INSTANCE_NAME;
});

t.test("it trims AIKIDO_INSTANCE_NAME", async (t) => {
  process.env.AIKIDO_INSTANCE_NAME = "  my-instance  ";
  t.equal(getInstanceHostname(), "my-instance");
  delete process.env.AIKIDO_INSTANCE_NAME;
});

t.test("it ignores a blank AIKIDO_INSTANCE_NAME", async (t) => {
  process.env.AIKIDO_INSTANCE_NAME = "   ";
  t.equal(getInstanceHostname(), hostname() || "");
  delete process.env.AIKIDO_INSTANCE_NAME;
});
