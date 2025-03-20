import * as t from "tap";
import { trustProxy } from "./trustProxy";

t.beforeEach(() => {
  delete process.env.AIKIDO_TRUST_PROXY;
});

t.test("the default is true", async () => {
  t.equal(trustProxy(), true);
});

t.test("trust proxy set to false", async () => {
  process.env.AIKIDO_TRUST_PROXY = "false";
  t.equal(trustProxy(), false);
});

t.test("trust proxy set to true", async () => {
  process.env.AIKIDO_TRUST_PROXY = "true";
  t.equal(trustProxy(), true);
});
