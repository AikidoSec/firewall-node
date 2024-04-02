type NumberList = Array<number>;

export function percentiles(percentiles: number[], list: NumberList): number[] {
  if (list.length === 0) {
    throw new Error("List should not be empty");
  }

  percentiles.forEach((p) => {
    if (p < 0) {
      throw new Error(
        `Expect percentile to be >= 0 but given "${p}" and its type is "${typeof p}".`
      );
    }

    if (p > 100) {
      throw new Error(
        `Expect percentile to be <= 100 but given "${p}" and its type is "${typeof p}".`
      );
    }
  });

  const sortedList: number[] = Array.from(list).sort((a, b) => a - b);

  return percentiles.map((p) => getPercentileValue(p, sortedList));
}

function getPercentileValue(p: number, list: number[]): number {
  if (p === 0) {
    return list[0];
  }

  const kIndex = Math.ceil(list.length * (p / 100)) - 1;

  return list[kIndex];
}
