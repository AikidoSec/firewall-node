const { exec } = require("child_process");

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      if (stderr) {
        reject(stderr);
      }
      resolve(stdout);
    });
  });
}

async function main(times = 10, maxDiffInPercentage = 8) {
  const results = [];
  for (let i = 0; i < times; i++) {
    const withGuard = await runScript("withGuard.js");
    const { averageTimeInMS: withGuardTimeInMS } = JSON.parse(withGuard);
    const withoutGuard = await runScript("withoutGuard.js");
    const { averageTimeInMS: withoutGuardTimeInMS } = JSON.parse(withoutGuard);
    results.push({
      withGuardTimeInMS,
      withoutGuardTimeInMS,
    });
  }

  const averagesDifferenceInPercentage = results.map((result) =>
    Math.abs(
      ((result.withGuardTimeInMS - result.withoutGuardTimeInMS) /
        result.withoutGuardTimeInMS) *
        100
    )
  );

  const averageDifferenceInPercentage =
    averagesDifferenceInPercentage.reduce((acc, diff) => acc + diff, 0) /
    averagesDifferenceInPercentage.length;

  if (averageDifferenceInPercentage > maxDiffInPercentage) {
    console.error(
      `The difference between the two benchmarks is too high: ${averageDifferenceInPercentage.toFixed(
        3
      )}%`
    );
    console.error(results);
    process.exit(1);
  } else {
    console.log(
      `The difference between the two benchmarks is acceptable: ${averageDifferenceInPercentage.toFixed(
        3
      )}%`
    );
  }
}

main();
