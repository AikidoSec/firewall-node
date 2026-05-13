import * as t from "tap";
import { warnBox } from "./warnBox";

t.test("it wraps a short message in a box", async () => {
  t.same(
    warnBox("Hello world."),
    `
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Hello world.                                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
`
  );
});

t.test("it word-wraps long messages", async () => {
  t.same(
    warnBox(
      "AIKIDO: Zen is NOT protecting your application. Your app runs in ESM mode, which requires the new hook system. Setup instructions: https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md"
    ),
    `
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  AIKIDO: Zen is NOT protecting your application. Your app runs in  │
│  ESM mode, which requires the new hook system. Setup               │
│  instructions:                                                     │
│  https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
`
  );
});
