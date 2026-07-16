import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { createMistralTests } from "./Mistral.tests";
import * as t from "tap";

if (isEsmUnitTest()) {
  createMistralTests("mistralai-v2");
} else {
  t.skip("Mistral v2 tests are only supported in ESM environment", () => {});
}
