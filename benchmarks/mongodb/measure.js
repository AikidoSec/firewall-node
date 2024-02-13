module.exports = async function measureFunctionPerformance(
  func,
  warmupIterations = 100,
  measuredIterations = 1000
) {
  for (let i = 0; i < warmupIterations; i++) {
    await func();
  }

  let totalExecutionTime = 0;
  for (let i = 0; i < measuredIterations; i++) {
    const start = performance.now();
    await func();
    const end = performance.now();
    totalExecutionTime += end - start;
  }

  const averageTime = totalExecutionTime / measuredIterations;
  console.log(
    `Average execution time over ${measuredIterations} iterations: ${averageTime.toFixed(2)} milliseconds`
  );
};
