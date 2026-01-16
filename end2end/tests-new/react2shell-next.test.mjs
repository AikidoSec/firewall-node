import { spawnSync, spawn } from "child_process";
import { resolve } from "path";
import { test, before } from "node:test";
import { deepStrictEqual, fail, match } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/react2shell-next"
);
const port = await getRandomPort();
const port2 = await getRandomPort();

before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToAppDir,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

async function testReact2Shell(targetUrl) {
  const boundary = "----WebKitFormBoundaryx8jO2oVc6SWP3Sad";

  const part0 = JSON.stringify({
    then: "$1:__proto__:then",
    status: "resolved_model",
    reason: -1,
    value: '{"then":"$B1337"}',
    _response: {
      _prefix:
        "var res=process.mainModule.require('child_process').execSync('echo $((41*271))').toString().trim();;throw Object.assign(new Error('NEXT_REDIRECT'),{digest: `NEXT_REDIRECT;push;/login?a=${res};307;`});",
      _chunks: "$Q2",
      _formData: { get: "$1:constructor:constructor" },
    },
  });

  const body = [
    `------WebKitFormBoundaryx8jO2oVc6SWP3Sad`,
    `Content-Disposition: form-data; name="0"`,
    ``,
    part0,
    `------WebKitFormBoundaryx8jO2oVc6SWP3Sad`,
    `Content-Disposition: form-data; name="1"`,
    ``,
    `"$@0"`,
    `------WebKitFormBoundaryx8jO2oVc6SWP3Sad`,
    `Content-Disposition: form-data; name="2"`,
    ``,
    `[]`,
    `------WebKitFormBoundaryx8jO2oVc6SWP3Sad--`,
  ].join("\r\n");

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Next-Action": "x",
      "X-Nextjs-Request-Id": "b5dce965",
    },
    body: body,
    redirect: "manual",
  });

  const redirectHeader = response.headers.get("X-Action-Redirect") || "";
  const isVulnerable = /.*\/login\?a=11111.*/.test(redirectHeader);

  return {
    vulnerable: isVulnerable,
    statusCode: response.status,
    redirectHeader: redirectHeader,
  };
}

test("vulnerable to RCE without Zen", async () => {
  const server = spawn(`node`, ["./.next/standalone/server.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      PORT: port,
      HOSTNAME: "127.0.0.1",
    },
  });

  try {
    server.on("error", (err) => {
      fail(err);
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for the server to start
    await timeout(2000);

    const result = await testReact2Shell(`http://127.0.0.1:${port}`);
    deepStrictEqual(result, {
      vulnerable: true,
      statusCode: 303,
      redirectHeader: "/login?a=11111;push",
    });
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

test("not vulnerable to RCE with Zen", async () => {
  const server = spawn(`node`, ["./.next/standalone/server.js"], {
    cwd: pathToAppDir,
    env: {
      ...process.env,
      AIKIDO_DEBUG: "true",
      AIKIDO_BLOCK: "true",
      PORT: port2,
      HOSTNAME: "127.0.0.1",
      NODE_OPTIONS: "-r @aikidosec/firewall",
    },
  });

  try {
    server.on("error", (err) => {
      fail(err);
    });

    let stdout = "";
    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    let stderr = "";
    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for the server to start
    await timeout(2000);

    const result = await testReact2Shell(`http://127.0.0.1:${port2}`);
    deepStrictEqual(result, {
      vulnerable: false,
      statusCode: 500,
      redirectHeader: "",
    });

    match(stdout, /Starting agent/);
    match(
      stderr,
      new RegExp(
        escapeStringRegexp(
          "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.fields.[0].value._response._prefix"
        )
      )
    );
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});

function escapeStringRegexp(string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
