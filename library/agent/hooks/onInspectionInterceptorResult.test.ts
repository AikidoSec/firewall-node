import * as t from "tap";
import { runWithContext, type Context } from "../Context";
import { createTestAgent } from "../../helpers/createTestAgent";
import { onInspectionInterceptorResult } from "./onInspectionInterceptorResult";
import type { AttackResult } from "./InterceptorResult";

const context: Context = {
  remoteAddress: "::1",
  method: "GET",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: { id: "1' -- " },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/orders",
};

const attack: AttackResult = {
  operation: "pg.query",
  kind: "sql_injection",
  source: "body",
  pathsToPayload: [".id"],
  metadata: { sql: "SELECT 1" },
  payload: "1' -- ",
};

function inspect(
  block: boolean,
  result: Parameters<typeof onInspectionInterceptorResult>[2]
) {
  const agent = createTestAgent({ block });
  const detected: unknown[] = [];
  agent.onDetectedAttack = (attack) => {
    detected.push(attack);
  };

  const run = () =>
    runWithContext(context, () =>
      onInspectionInterceptorResult(
        context,
        agent,
        result,
        { name: "pg", type: "external", version: "8.0.0" },
        "pg.query",
        "sql_op"
      )
    );

  return { run, detected };
}

t.test(
  "it reports an attack that was detected with an IDOR violation",
  async (t) => {
    const { run, detected } = inspect(false, {
      idorViolation: true,
      message: "Zen IDOR protection: missing tenant filter",
      attack,
    });

    t.throws(run, "Zen IDOR protection: missing tenant filter");
    t.match(detected, [
      { kind: "sql_injection", blocked: false, operation: "pg.query" },
    ]);
  }
);

t.test("it only throws for an IDOR violation without an attack", async (t) => {
  const { run, detected } = inspect(false, {
    idorViolation: true,
    message: "Zen IDOR protection: missing tenant filter",
  });

  t.throws(run, "Zen IDOR protection: missing tenant filter");
  t.same(detected, []);
});

t.test(
  "it reports and does not throw for an attack in detection mode",
  async (t) => {
    const { run, detected } = inspect(false, attack);

    t.doesNotThrow(run);
    t.match(detected, [{ kind: "sql_injection", blocked: false }]);
  }
);
