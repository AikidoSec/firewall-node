import * as t from "tap";
import { Domains } from "./Domains";

t.test("it works", async () => {
  const domains = new Domains(3);
  t.same(domains.getDomains(), []);

  domains.add("aikido.dev");
  t.same(domains.getDomains(), ["aikido.dev"]);

  domains.add("aikido.dev");
  t.same(domains.getDomains(), ["aikido.dev"]);

  domains.add("google.com");
  t.same(domains.getDomains(), ["aikido.dev", "google.com"]);

  domains.add("github.com");
  t.same(domains.getDomains(), ["aikido.dev", "google.com", "github.com"]);

  domains.add("jetbrains.com");
  t.same(domains.getDomains(), ["google.com", "github.com", "jetbrains.com"]);

  domains.clear();
  t.same(domains.getDomains(), []);
});
