type HookName = "beforeSQLExecute";

// Map hook names to argument and return types
interface HookTypes {
  beforeSQLExecute: {
    args: [sql: string];
    return: void;
  };
}

const hooks = new Map<
  HookName,
  Array<(...args: HookTypes[HookName]["args"]) => HookTypes[HookName]["return"]>
>();

export function addHook<N extends HookName>(
  name: N,
  fn: (...args: HookTypes[N]["args"]) => HookTypes[N]["return"]
) {
  if (!hooks.has(name)) {
    hooks.set(name, [fn]);
  } else {
    hooks.get(name)!.push(fn);
  }
}

export function removeHook<N extends HookName>(
  name: N,
  fn: (...args: HookTypes[N]["args"]) => HookTypes[N]["return"]
) {
  if (hooks.has(name)) {
    const fns = hooks.get(name)!;
    const index = fns.indexOf(fn);
    if (index !== -1) {
      fns.splice(index, 1);
    }
  }
}

export function executeHooks<N extends HookName>(
  name: N,
  ...args: [...HookTypes[N]["args"]]
): Array<HookTypes[N]["return"]> {
  const results: Array<HookTypes[N]["return"]> = [];
  const hookList = hooks.get(name);

  for (const fn of hookList ?? []) {
    const result = (
      fn as (...args: HookTypes[N]["args"]) => HookTypes[N]["return"]
    )(...args);
    if (result !== undefined) {
      results.push(result);
    }
  }
  return results;
}
