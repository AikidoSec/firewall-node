import * as t from "tap";
import { percentiles } from "./percentiles";

function generateArray(
  length: number,
  fn: (value: unknown, index: number) => number
) {
  return Array.from({ length: length }).map(fn);
}

function generateArraySimple(length: number) {
  return generateArray(length, (v, i) => i + 1);
}

function shuffleArray(arr: number[]) {
  return arr.sort(() => 0.5 - Math.random());
}

const stubsSimple = [
  { percentile: 0, list: shuffleArray(generateArraySimple(100)), result: 1 },
  { percentile: 25, list: shuffleArray(generateArraySimple(100)), result: 25 },
  { percentile: 50, list: shuffleArray(generateArraySimple(100)), result: 50 },
  { percentile: 75, list: shuffleArray(generateArraySimple(100)), result: 75 },
  {
    percentile: 100,
    list: shuffleArray(generateArraySimple(100)),
    result: 100,
  },
  {
    percentile: 75,
    list: shuffleArray(
      generateArraySimple(100).concat(generateArraySimple(30))
    ),
    result: 68,
  },
];

t.test("percentile of simple values", async (t) => {
  stubsSimple.forEach((stub) => {
    t.same(
      percentiles([stub.percentile], stub.list),
      [stub.result],
      JSON.stringify(stub)
    );
  });
});

t.test("percentile with negative values", async (t) => {
  t.same(percentiles([50], shuffleArray([-1, -2, -3, -4, -5])), [-3]);
  t.same(percentiles([50], shuffleArray([7, 6, -1, -2, -3, -4, -5])), [-2]);
});

t.test("array of percentiles", async (t) => {
  t.same(
    percentiles([0, 25, 50, 75, 100], shuffleArray(generateArraySimple(100))),
    [1, 25, 50, 75, 100]
  );
});

t.test("throw an error if less than 0", async (t) => {
  t.throws(() => percentiles([-1], [1]));
});

t.test("throw an error if grater than 100", async (t) => {
  t.throws(() => percentiles([101], [1]));
});

t.test("empty list", async (t) => {
  t.throws(() => percentiles([50], []));
});
