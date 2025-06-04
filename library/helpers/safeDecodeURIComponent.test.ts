import * as t from "tap";
import { safeDecodeURIComponent } from "./safeDecodeURIComponent";

t.setTimeout(60000);

t.test("it decodes a URI component (static tests)", async (t) => {
  t.equal(safeDecodeURIComponent("%20"), " ");
  t.equal(safeDecodeURIComponent("%3A"), ":");
  t.equal(safeDecodeURIComponent("%2F"), "/");
  t.equal(safeDecodeURIComponent("%252F"), "%2F");
  t.equal(safeDecodeURIComponent("test%20test"), "test test");
  t.equal(safeDecodeURIComponent("test%3Atest"), "test:test");
  t.equal(safeDecodeURIComponent(encodeURIComponent("✨")), "✨");
  t.equal(safeDecodeURIComponent(encodeURIComponent("💜")), "💜");
  t.equal(safeDecodeURIComponent(encodeURIComponent("اللغة")), "اللغة");
  t.equal(safeDecodeURIComponent(encodeURIComponent("Γλώσσα")), "Γλώσσα");
  t.equal(safeDecodeURIComponent(encodeURIComponent("言語")), "言語");
  t.equal(safeDecodeURIComponent(encodeURIComponent("语言")), "语言");
  t.equal(safeDecodeURIComponent(encodeURIComponent("語言")), "語言");
});

t.test("it returns undefined for invalid URI components", async (t) => {
  t.equal(safeDecodeURIComponent("%"), undefined);
  t.equal(safeDecodeURIComponent("%2"), undefined);
  t.equal(safeDecodeURIComponent("%2G"), undefined);
  t.equal(safeDecodeURIComponent("%2g"), undefined);
  t.equal(safeDecodeURIComponent("test%gtest"), undefined);
  t.equal(safeDecodeURIComponent("test%test"), undefined);
  t.equal(safeDecodeURIComponent("%99"), undefined);
});

function generateRandomTestString(
  length = Math.floor(Math.random() * 100) + 1
) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-_~%+";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const testCases = [
  "test",
  "42",
  "a+b+c+d",
  "=a",
  "%25",
  "%%25%%",
  "st%C3%A5le",
  "st%C3%A5le%",
  "%st%C3%A5le%",
  "%%7Bst%C3%A5le%7D%",
  "%ab%C3%A5le%",
  "%C3%A5%able%",
  "%7B%ab%7C%de%7D",
  "%7B%ab%%7C%de%%7D",
  "%7 B%ab%%7C%de%%7 D",
  "%61+%4d%4D",
  "\uFEFFtest",
  "\uFEFF",
  "%EF%BB%BFtest",
  "%EF%BB%BF",
  "†",
  "%C2%B5",
  "%C2%B5%",
  "%%C2%B5%",
  "%ab",
  "%ab%ab%ab",
  "%",
  "%2",
  "%E0%A4%A",
  '/test/hel%"Flo',
  "/test/hel%2Flo",
  "%E8%AF%AD%E8%A8%80",
  "%",
  "%2",
  "%2G",
  "%2g",
  "%2g%2g",
  "test%2gtest",
  "test%test",
  "%99",
];

const randomTestCases = 10_000;
const randomStrings = Array.from({ length: randomTestCases }, () =>
  generateRandomTestString()
);

const allTestCases = [...testCases, ...randomStrings];

t.test("compare with original decodeURIComponent", async (t) => {
  for (const testCase of allTestCases) {
    let origResult = undefined;
    try {
      origResult = decodeURIComponent(testCase);
    } catch {
      //
    }
    if (safeDecodeURIComponent(testCase) !== origResult) {
      t.fail(
        `safeDecodeURIComponent("${testCase}") !== decodeURIComponent("${testCase}")`
      );
    }
  }

  t.pass("All test cases passed");
});

t.test("benchmark", async (t) => {
  const startOrig = performance.now();
  for (const testCase of allTestCases) {
    try {
      decodeURIComponent(testCase);
    } catch {
      //
    }
  }
  const endOrig = performance.now();

  const startSafe = performance.now();
  for (const testCase of allTestCases) {
    safeDecodeURIComponent(testCase);
  }
  const endSafe = performance.now();

  const origDuration = endOrig - startOrig;
  const safeDuration = endSafe - startSafe;
  t.ok(
    safeDuration < origDuration,
    `safeDecodeURIComponent is faster than decodeURIComponent`
  );

  const origSpeedup = (origDuration - safeDuration) / origDuration;
  t.ok(
    origSpeedup > 0.7,
    `safeDecodeURIComponent is at least 70% faster than decodeURIComponent`
  );
  t.comment(`Perdormance improvement: ${origSpeedup * 100}%`);
});

// The following tests are ported from test262, the Official ECMAScript Conformance Test Suite
// https://github.com/tc39/test262
// Licensed under the MIT License
// Copyright (C) 2012 Ecma International

t.test("S15.1.3.2_A1.10_T1", async (t) => {
  const interval = [
    [0x00, 0x2f],
    [0x3a, 0x40],
    [0x47, 0x60],
    [0x67, 0xffff],
  ];
  for (let indexI = 0; indexI < interval.length; indexI++) {
    for (
      let indexJ = interval[indexI][0];
      indexJ <= interval[indexI][1];
      indexJ++
    ) {
      if (
        safeDecodeURIComponent("%C0%" + String.fromCharCode(indexJ, indexJ)) !==
        undefined
      ) {
        t.fail(
          `safeDecodeURIComponent("%C0%${String.fromCharCode(
            indexJ,
            indexJ
          )}") should be undefined`
        );
      }
    }

    t.pass("All test cases passed");
  }
});

t.test("S15.1.3.2_A1.11_T1", async (t) => {
  const interval = [
    [0x00, 0x2f],
    [0x3a, 0x40],
    [0x47, 0x60],
    [0x67, 0xffff],
  ];
  for (let indexI = 0; indexI < interval.length; indexI++) {
    for (
      let indexJ = interval[indexI][0];
      indexJ <= interval[indexI][1];
      indexJ++
    ) {
      if (
        safeDecodeURIComponent(
          "%E0%" + String.fromCharCode(indexJ, indexJ) + "%A0"
        ) !== undefined
      ) {
        t.fail(
          `safeDecodeURIComponent("%E0%${String.fromCharCode(
            indexJ,
            indexJ
          )}%A0") should be undefined`
        );
      }
    }
  }

  t.pass("All test cases passed");
});

t.test("S15.1.3.2_A1.1_T1", async (t) => {
  t.equal(safeDecodeURIComponent("%"), undefined);
  t.equal(safeDecodeURIComponent("%A"), undefined);
  t.equal(safeDecodeURIComponent("%1"), undefined);
  t.equal(safeDecodeURIComponent("% "), undefined);
});

t.test("S15.1.3.2_A3_T1", async (t) => {
  t.equal(safeDecodeURIComponent("%3B"), ";");
  t.equal(safeDecodeURIComponent("%2F"), "/");
  t.equal(safeDecodeURIComponent("%3F"), "?");
  t.equal(safeDecodeURIComponent("%3A"), ":");
  t.equal(safeDecodeURIComponent("%40"), "@");
  t.equal(safeDecodeURIComponent("%26"), "&");
  t.equal(safeDecodeURIComponent("%3D"), "=");
  t.equal(safeDecodeURIComponent("%2B"), "+");
  t.equal(safeDecodeURIComponent("%24"), "$");
  t.equal(safeDecodeURIComponent("%2C"), ",");
  t.equal(safeDecodeURIComponent("%23"), "#");
});

t.test("S15.1.3.2_A3_T2", async (t) => {
  t.equal(safeDecodeURIComponent("%3b"), ";");
  t.equal(safeDecodeURIComponent("%2f"), "/");
  t.equal(safeDecodeURIComponent("%3f"), "?");
  t.equal(safeDecodeURIComponent("%3a"), ":");
  t.equal(safeDecodeURIComponent("%40"), "@");
  t.equal(safeDecodeURIComponent("%26"), "&");
  t.equal(safeDecodeURIComponent("%3d"), "=");
  t.equal(safeDecodeURIComponent("%2b"), "+");
  t.equal(safeDecodeURIComponent("%24"), "$");
  t.equal(safeDecodeURIComponent("%2c"), ",");
  t.equal(safeDecodeURIComponent("%23"), "#");
});

t.test("S15.1.3.2_A3_T3", async (t) => {
  t.equal(
    safeDecodeURIComponent("%3B%2F%3F%3A%40%26%3D%2B%24%2C%23"),
    ";/?:@&=+$,#"
  );
  t.equal(
    safeDecodeURIComponent("%3b%2f%3f%3a%40%26%3d%2b%24%2c%23"),
    ";/?:@&=+$,#"
  );
});

t.test("S15.1.3.2_A4_T1", async (t) => {
  t.equal(
    safeDecodeURIComponent(
      "%41%42%43%44%45%46%47%48%49%4A%4B%4C%4D%4E%4F%50%51%52%53%54%55%56%57%58%59%5A"
    ),
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  );
  t.equal(
    safeDecodeURIComponent(
      "%61%62%63%64%65%66%67%68%69%6A%6B%6C%6D%6E%6F%70%71%72%73%74%75%76%77%78%79%7A"
    ),
    "abcdefghijklmnopqrstuvwxyz"
  );
});
