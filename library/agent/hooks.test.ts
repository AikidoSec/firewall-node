import * as t from "tap";
import { addHook, removeHook, executeHooks } from "./hooks";

t.test("it works", async (t) => {
  let hookOneCalls = 0;
  let hookTwoCalls = 0;

  function hook1(sql: string) {
    t.equal(sql, "SELECT 1");
    hookOneCalls++;
  }
  function hook2(sql: string) {
    t.equal(sql, "SELECT 1");
    hookTwoCalls++;
  }

  function hook3() {
    throw new Error("hook3 should not be called");
  }

  t.same(hookOneCalls, 0, "hookOneCalls starts at 0");
  t.same(hookTwoCalls, 0, "hookTwoCalls starts at 0");

  executeHooks("beforeSQLExecute", "SELECT 1");

  t.same(hookOneCalls, 0, "hookOneCalls still at 0");
  t.same(hookTwoCalls, 0, "hookTwoCalls still at 0");

  addHook("beforeSQLExecute", hook1);
  // @ts-expect-error some other hook is not defined in the types
  addHook("someOtherHook", hook3);
  executeHooks("beforeSQLExecute", "SELECT 1");

  t.equal(hookOneCalls, 1, "hook1 called once");
  t.equal(hookTwoCalls, 0, "hook2 not called");

  addHook("beforeSQLExecute", hook2);
  t.same(executeHooks("beforeSQLExecute", "SELECT 1"), [], "no value returned");

  t.equal(hookOneCalls, 2, "hook1 called twice");
  t.equal(hookTwoCalls, 1, "hook2 called once");

  removeHook("beforeSQLExecute", hook1);
  executeHooks("beforeSQLExecute", "SELECT 1");

  t.equal(hookOneCalls, 2, "hook1 still called twice");
  t.equal(hookTwoCalls, 2, "hook2 called twice");

  removeHook("beforeSQLExecute", hook2);
  t.same(executeHooks("beforeSQLExecute", "SELECT 1"), [], "no hooks executed");

  t.equal(hookOneCalls, 2, "hook1 still called twice");
  t.equal(hookTwoCalls, 2, "hook2 still called twice");

  // @ts-expect-error returnTest is not defined in the types
  addHook("returnTest", () => {
    return 1;
  });
  // @ts-expect-error returnTest is not defined in the types
  addHook("returnTest", () => {
    return 2;
  });
  // @ts-expect-error returnTest is not defined in the types
  t.same(executeHooks("returnTest"), [1, 2], "returns values from hooks");
});
