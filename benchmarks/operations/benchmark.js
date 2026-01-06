const { spawnSync, spawn } = require("child_process");
const { setTimeout } = require("timers/promises");

const modules = [
  {
    module: "sqli",
    name: "SQL query",
  },
  {
    module: "path-traversal",
    name: "File read",
  },
  {
    module: "nosqli",
    name: "NoSQL query",
  },
  {
    module: "jsinjection",
    name: "`new Function(...)` / `eval(...)`",
  },
  {
    module: "shelli",
    name: "Shell command",
  },
  {
    module: "fetch",
    name: "Outgoing HTTP request (`fetch`)",
  },
  {
    module: "http-request",
    name: "Outgoing HTTP request (`http.request`)",
  },
  {
    module: "undici",
    name: "Outgoing HTTP request (`undici.request`)",
  },
];

(async () => {
  let server = spawn("node", ["spawn-server.js"], {
    cwd: __dirname,
  });

  let stderr = "";
  server.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  server.on("error", () => {
    console.error(stderr);
  });

  await setTimeout(500);

  try {
    let markdownTable =
      "| Benchmark           | Avg. time w/o Zen | Avg. time w/ Zen | Delta      |\n";
    markdownTable +=
      "|---------------------|-------------------|------------------|------------|\n";

    for (const { module, name } of modules) {
      console.log();
      console.log(`Running module ${module}`);
      const withoutZen = spawnSync(`node`, ["run.js", module, "false"], {
        cwd: __dirname,
        maxBuffer: 1024 * 1024 * 1024,
      });

      if (withoutZen.status !== 0) {
        throw new Error(withoutZen.stderr.toString());
      }

      let timingsWithoutZen;
      try {
        timingsWithoutZen = JSON.parse(withoutZen.stdout.toString());
      } catch (e) {
        throw new Error(withoutZen.stdout.toString());
      }

      const withZen = spawnSync("node", ["run.js", module, "true"], {
        cwd: __dirname,
        maxBuffer: 1024 * 1024 * 1024,
      });

      if (withZen.status !== 0) {
        throw new Error(withZen.stderr.toString());
      }

      let timingsWithZen;
      try {
        timingsWithZen = JSON.parse(withZen.stdout.toString());
      } catch (e) {
        throw new Error(withZen.stdout.toString());
      }

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
        `Average time without Zen: ${formatter.format(averageWithoutZen)}ms`
      );
      console.log(
        `Average time with Zen: ${formatter.format(averageWithZen)}ms`
      );
      const deltaFormatted = formatter.format(delta).startsWith("-")
        ? formatter.format(delta)
        : `+${formatter.format(delta)}`;
      console.log(`Delta: ${deltaFormatted}ms`);

      markdownTable += `| ${name} | ${formatter.format(averageWithoutZen)}ms | ${formatter.format(averageWithZen)}ms | +${formatter.format(delta)}ms |\n`;
    }

    console.log();
    console.log(markdownTable);
  } finally {
    server.kill();
  }
})();
