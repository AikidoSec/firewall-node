const { exec } = require("child_process");
const percentile = require("percentile");

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    exec(
      `node --no-deprecation ${scriptPath}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        }
        if (stderr) {
          reject(stderr);
        }
        resolve(stdout);
      },
      {
        env: {
          ...process.env,
          AIKIDO_BLOCKING: "true",
        },
      }
    );
  });
}

async function main(maxDiffInMS = 0.1) {
  const withGuard = await runScript("withGuard.js");
  const withGuardTimings = JSON.parse(withGuard);
  const withoutGuard = await runScript("withoutGuard.js");
  const withoutGuardTimings = JSON.parse(withoutGuard);
  const meanWithGuard = percentile(50, withGuardTimings);
  const meanWithoutGuard = percentile(50, withoutGuardTimings);
  const differenceInMS = Math.abs(meanWithGuard - meanWithoutGuard);

  if (differenceInMS > maxDiffInMS) {
    console.error(
      `The difference between the two benchmarks is too high: ${differenceInMS.toFixed(
        3
      )}`
    );
    process.exit(1);
  } else {
    console.log(
      `The difference between the two benchmarks is acceptable: ${differenceInMS.toFixed(
        3
      )}`
    );
  }
}

main();
