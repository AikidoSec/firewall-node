import * as t from "tap";
import type BuiltPlugins from "tap";
import { MongoDB } from "../sinks/MongoDB";
import { Agent } from "./Agent";
import { ReportingAPIForTesting } from "./api/ReportingAPIForTesting";
import { ReportingAPINodeHTTP } from "./api/ReportingAPINodeHTTP";
import { Event, DetectedAttack } from "./api/Event";
import { Token } from "./api/Token";
import { Hooks } from "./hooks/Hooks";
import { LoggerNoop } from "./logger/LoggerNoop";
import { Wrapper } from "./Wrapper";
import {
  agentStartedEvent,
  detectedAttackEvent,
  expectedDetectedAttackEvent,
} from "../testSupport/fixtures/Agent.fixture";
import Sinon from "sinon";

t.test("Agent tests", (t) => {
  t.plan(13);

  t.test("Starting up agent", async (t) => {
    let logger: LoggerNoop;
    let api: ReportingAPIForTesting;
    let token: Token;
    let fakeAgent: Agent;

    t.plan(4);

    t.test("it throws error if serverless is empty string", async (t) => {
      t.throws(
        () =>
          new Agent(
            true,
            new LoggerNoop(),
            new ReportingAPIForTesting(),
            undefined,
            ""
          ),
        "Serverless cannot be an empty string"
      );
    });

    t.beforeEach(() => {
      logger = new LoggerNoop();
      api = new ReportingAPIForTesting();
      token = new Token("123");
      fakeAgent = new Agent(true, logger, api, token, undefined);
    });

    t.test("it sends started event", async (t) => {
      fakeAgent.start([new MongoDB()]);
      t.match(api.getEvents(), [agentStartedEvent]);
    });

    t.test("it throws error if already started", async (t) => {
      fakeAgent.start([new MongoDB()]);
      t.throws(
        () => fakeAgent.start([new MongoDB()]),
        "Agent already started!"
      );
    });

    t.test("should log unspported packages", async (t) => {
      const loggerSpy = t.sinon.spy(LoggerNoop.prototype, "log");
      fakeAgent.start([new WrapperForTesting()]);
      const expectedLogs = [
        "Starting agent...",
        "Found token, reporting enabled!",
        "shell-quote@1.8.1 is not supported!",
      ];

      assertLogs(t.sinon, loggerSpy, expectedLogs);
    });
  });

  t.test("it starts in non-blocking mode", async (t) => {
    const loggerSpy = t.sinon.spy(LoggerNoop.prototype, "log");

    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(false, logger, api, token, undefined);
    agent.start([new MongoDB()]);

    const expectedLogs = [
      "Starting agent...",
      "Dry mode enabled, no requests will be blocked!",
      "Found token, reporting enabled!",
      "mongodb@6.3.0 is supported!",
    ];

    assertLogs(t.sinon, loggerSpy, expectedLogs);
  });

  t.test("when prevent prototype pollution is enabled", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, "lambda");
    agent.onPrototypePollutionPrevented();
    agent.start([]);
    t.match(api.getEvents(), [
      {
        agent: {
          preventedPrototypePollution: true,
          stack: ["lambda"],
        },
      },
    ]);
  });

  t.test("it does not start interval in serverless mode", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, "lambda");

    // This would otherwise keep the process running
    agent.start([]);
  });

  t.test("when attack detected", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.onDetectedAttack(Object.assign(detectedAttackEvent));

    t.match(api.getEvents(), [expectedDetectedAttackEvent]);
  });

  t.test("it checks if user agent is a string", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.onDetectedAttack(Object.assign(detectedAttackEvent));

    t.match(api.getEvents(), [expectedDetectedAttackEvent]);
  });

  t.test("it sends heartbeat when reached max timings", async (t) => {
    const clock = t.sinon.useFakeTimers();

    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);
    for (let i = 0; i < 1000; i++) {
      agent.getInspectionStatistics().onInspectedCall({
        sink: "mongodb",
        blocked: false,
        durationInMs: 0.1,
        attackDetected: false,
        withoutContext: false,
      });
    }
    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);
    for (let i = 0; i < 4001; i++) {
      agent.getInspectionStatistics().onInspectedCall({
        sink: "mongodb",
        blocked: false,
        durationInMs: 0.1,
        attackDetected: false,
        withoutContext: false,
      });
    }

    // After 5 seconds, nothing should happen
    clock.tick(1000 * 5);

    t.match(api.getEvents(), [
      {
        type: "started",
      },
    ]);

    // After 10 minutes, we'll see that the required amount of performance samples has been reached
    // And then send a heartbeat
    clock.tick(10 * 60 * 1000);
    await clock.nextAsync();

    t.match(api.getEvents(), [
      {
        type: "started",
      },
      {
        type: "heartbeat",
      },
    ]);

    // After another 10 minutes, we'll see that we already sent the initial stats
    clock.tick(10 * 60 * 1000);
    await clock.nextAsync();

    t.match(api.getEvents(), [
      {
        type: "started",
      },
      {
        type: "heartbeat",
      },
    ]);

    // Every 30 minutes we'll send a heartbeat
    clock.tick(30 * 60 * 1000);
    await clock.nextAsync();

    t.match(api.getEvents(), [
      {
        type: "started",
      },
      {
        type: "heartbeat",
      },
      {
        type: "heartbeat",
      },
    ]);

    clock.restore();
  });

  t.test("it logs when failed to report event", async (t) => {
    const loggerSpy = t.sinon.spy(LoggerNoop.prototype, "log");
    t.sinon
      .stub(ReportingAPINodeHTTP.prototype, "report")
      .rejects("Failed to report event");
    const logger = new LoggerNoop();
    const api = new ReportingAPINodeHTTP(new URL("http://localhost:4000"));
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);

    await waitForCalls();

    // @ts-expect-error Private method
    agent.heartbeat();

    await waitForCalls();

    agent.onDetectedAttack(Object.assign(detectedAttackEvent));

    await waitForCalls();

    const expectedLogs = [
      "Starting agent...",
      "Found token, reporting enabled!",
      "Failed to start agent",
      "Heartbeat...",
      "Failed to do heartbeat",
      "Failed to report attack",
    ];

    assertLogs(t.sinon, loggerSpy, expectedLogs);
  });

  t.test("unable to prevent prototype pollution", async (t) => {
    const clock = t.sinon.useFakeTimers();

    const loggerSpy = t.sinon.spy(LoggerNoop.prototype, "log");
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);

    agent.unableToPreventPrototypePollution({ mongoose: "1.0.0" });

    const expectedLogs = [
      "Starting agent...",
      "Found token, reporting enabled!",
      "Unable to prevent prototype pollution, incompatible packages found: mongoose@1.0.0",
    ];

    assertLogs(t.sinon, loggerSpy, expectedLogs);

    clock.tick(1000 * 60 * 30);
    await clock.nextAsync();

    t.same(api.getEvents().length, 2);
    const [_, heartbeat] = api.getEvents();
    t.same(heartbeat.type, "heartbeat");
    t.same(heartbeat.agent.incompatiblePackages, {
      prototypePollution: {
        mongoose: "1.0.0",
      },
    });

    clock.restore();
  });

  t.test("when payload is object", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);

    agent.onDetectedAttack(
      Object.assign({ ...detectedAttackEvent, payload: { $gt: "" } })
    );
    agent.onDetectedAttack(
      Object.assign({ ...detectedAttackEvent, payload: "a".repeat(20000) })
    );

    function isDetectedAttack(event: Event): event is DetectedAttack {
      return event.type === "detected_attack";
    }

    t.same(
      api
        .getEvents()
        .filter(isDetectedAttack)
        .map((event) => event.attack.payload),
      [
        JSON.stringify({ $gt: "" }),
        JSON.stringify("a".repeat(20000)).substring(0, 4096),
      ]
    );
  });

  t.test("it sends hostnames and routes along with heartbeat", async (t) => {
    const logger = new LoggerNoop();
    const api = new ReportingAPIForTesting();
    const token = new Token("123");
    const agent = new Agent(true, logger, api, token, undefined);
    agent.start([]);

    agent.onConnectHostname("aikido.dev", 443);
    agent.onConnectHostname("aikido.dev", 80);
    agent.onConnectHostname("google.com", 443);
    agent.onRouteExecute("POST", "/posts/:id");
    agent.onRouteExecute("POST", "/posts/:id");
    agent.onRouteExecute("GET", "/posts/:id");
    agent.onRouteExecute("GET", "/");

    api.clear();

    await agent.flushStats(1000);

    t.match(api.getEvents(), [
      {
        type: "heartbeat",
        hostnames: [
          {
            hostname: "aikido.dev",
            port: 443,
          },
          {
            hostname: "google.com",
            port: 443,
          },
        ],
        routes: [],
      },
    ]);
  });

  t.test(
    "it goes into monitoring mode after sending startup event",
    async (t) => {
      const logger = new LoggerNoop();
      const api = new ReportingAPIForTesting({
        success: true,
        endpoints: [],
        configUpdatedAt: 0,
        heartbeatIntervalInMS: 10 * 60 * 1000,
        blockedUserIds: [],
        allowedIPAddresses: [],
        block: false,
      });
      const token = new Token("123");
      const agent = new Agent(true, logger, api, token, undefined);
      t.same(agent.shouldBlock(), true);
      agent.start([]);

      // Wait for the event to be sent
      await new Promise((resolve) => setTimeout(resolve, 0));

      t.same(agent.shouldBlock(), false);
    }
  );

  t.test("Enable blocking mode", async (t) => {
    t.plan(2);
    const logger = new LoggerNoop();
    const token = new Token("123");

    const api = new ReportingAPIForTesting();
    t.test(
      "it stays on monitoring mode if server did not return block mode",
      async (t) => {
        const agent = new Agent(false, logger, api, token, undefined);
        t.same(agent.shouldBlock(), false);
        agent.start([]);

        // Wait for the event to be sent
        await waitForCalls();

        t.same(agent.shouldBlock(), false);
      }
    );

    t.test(
      "it enables blocking mode after sending startup event",
      async (t) => {
        const api = new ReportingAPIForTesting({
          success: true,
          endpoints: [],
          configUpdatedAt: 0,
          heartbeatIntervalInMS: 10 * 60 * 1000,
          blockedUserIds: [],
          allowedIPAddresses: [],
          block: true,
        });
        const agent = new Agent(false, logger, api, token, undefined);
        t.same(agent.shouldBlock(), false);
        agent.start([]);

        // Wait for the event to be sent
        await waitForCalls();

        t.same(agent.shouldBlock(), true);
      }
    );
  });
});

class WrapperForTesting implements Wrapper {
  wrap(hooks: Hooks) {
    hooks.addPackage("shell-quote").withVersion("^3.0.0");
  }
}

// API calls are async, wait for them to finish
const waitForCalls = () => new Promise((resolve) => setTimeout(resolve, 0));

const assertLogs = (
  sinon: Sinon.SinonSandbox,
  spy: Sinon.SinonSpy,
  expectedLogs: string[]
) => {
  sinon.assert.callCount(spy, expectedLogs.length);

  spy.getCall(0).args.forEach((value, i) => {
    sinon.assert.match(value, expectedLogs[i]);
  });
};
