const { spawnSync } = require("child_process");

const modules = [
  {
    module: "sqli",
    name: "Run SQL query",
  },
];

let markdownTable =
  "| Benchmark           | Avg. time w/o Zen | Avg. time w/ Zen | Delta      |\n";
markdownTable +=
  "|---------------------|-------------------|------------------|------------|\n";

for (const { module, name } of modules) {
  console.log();
  console.log(`Running module ${module}`);
  const withoutZen = spawnSync(`node`, ["run.js", module, "false"], {
    cwd: __dirname,
  });

  if (withoutZen.status !== 0) {
    console.error(withoutZen.stderr.toString());
    process.exit(1);
  }

  const timingsWithoutZen = JSON.parse(withoutZen.stdout.toString());

  const withZen = spawnSync("node", ["run.js", module, "true"], {
    cwd: __dirname,
  });

  if (withZen.status !== 0) {
    console.error(withZen.stderr.toString());
    process.exit(1);
  }

  const timingsWithZen = JSON.parse(withZen.stdout.toString());
  const averageWithoutZen =
    timingsWithoutZen.reduce((a, b) => a + b, 0) / timingsWithoutZen.length;
  const averageWithZen =
    timingsWithZen.reduce((a, b) => a + b, 0) / timingsWithZen.length;
  const delta = averageWithZen - averageWithoutZen;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "decimal",
    maximumFractionDigits: 4,
  });

  console.log(`Module: ${name}`);
  console.log(
    `Average time without Zen: ${formatter.format(averageWithoutZen)} ms`
  );
  console.log(`Average time with Zen: ${formatter.format(averageWithZen)} ms`);
  console.log(`Delta: ${formatter.format(delta)} ms`);

  markdownTable += `| ${name} | ${formatter.format(averageWithoutZen)} ms | ${formatter.format(averageWithZen)} ms | ${formatter.format(delta)} ms |\n`;
}

console.log();
console.log(markdownTable);
