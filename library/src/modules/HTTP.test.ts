import * as t from "tap";
import { Agent } from "../agent/Agent";
import { setInstance } from "../agent/AgentSingleton";
import { APIForTesting } from "../agent/API";
import { IDGeneratorFixed } from "../agent/IDGenerator";
import { LoggerNoop } from "../agent/Logger";
import { HTTP } from "./HTTP";

t.test("http", async (t) => {
  new HTTP().setup();
  const http = await import("http");

  setInstance(
    new Agent(
      false,
      new LoggerNoop(),
      new APIForTesting(),
      undefined,
      [],
      new IDGeneratorFixed("id"),
      false
    )
  );

  await new Promise<void>((resolve) => {
    const req = http.request(
      "http://localhost:4000",
      { method: "GET" },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          resolve();
        });
      }
    );

    req.end();
  });

  await fetch("http://localhost:4000", { method: "GET" });
});
