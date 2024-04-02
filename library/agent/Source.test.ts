import * as t from "tap";
import { sourceHumanName } from "./Source";

t.test("it returns human name", async () => {
  t.same(sourceHumanName("query"), "query parameters");
  t.same(sourceHumanName("body"), "body");
  t.same(sourceHumanName("headers"), "headers");
  t.same(sourceHumanName("cookies"), "cookies");
});
