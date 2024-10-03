import t from "tap";
import { getAgentVersion } from "./getAgentVersion";

t.test("it returns the current library version", async () => {
  t.equal(getAgentVersion(), "0.0.0");
});
