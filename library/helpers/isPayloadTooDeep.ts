import { isPlainObject } from "./isPlainObject";

type Frame = {
  depth: number;
  iterator: IterableIterator<unknown>;
  value: object;
};

function* objectValues(
  value: Record<string, unknown>
): IterableIterator<unknown> {
  for (const key in value) {
    yield value[key];
  }
}

function getChildIterator(
  value: unknown
): IterableIterator<unknown> | undefined {
  if (Array.isArray(value)) {
    return value.values();
  }

  if (isPlainObject(value)) {
    return objectValues(value);
  }

  return undefined;
}

export function isPayloadTooDeep(payload: unknown, maxDepth: number): boolean {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) {
    return false;
  }

  try {
    const iterator = getChildIterator(payload);
    if (!iterator) {
      return false;
    }

    const root = payload as object;
    const ancestors = new WeakSet<object>([root]);
    const stack: Frame[] = [{ depth: 1, iterator, value: root }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const next = frame.iterator.next();

      if (next.done) {
        ancestors.delete(frame.value);
        stack.pop();
        continue;
      }

      const childIterator = getChildIterator(next.value);
      if (!childIterator || ancestors.has(next.value as object)) {
        continue;
      }

      if (frame.depth >= maxDepth) {
        return true;
      }

      const child = next.value as object;
      ancestors.add(child);
      stack.push({
        depth: frame.depth + 1,
        iterator: childIterator,
        value: child,
      });
    }

    return false;
  } catch {
    return true;
  }
}
