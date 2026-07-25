import t from "tap";
import { escapeHTML } from "./escapeHTML";

t.test('should escape "&" character', async (t) => {
  const input = "Dolce & Gabbana";
  const expected = "Dolce &amp; Gabbana";
  t.equal(escapeHTML(input), expected, 'should escape "&" to "&amp;"');
});

t.test('should escape "<" character', async (t) => {
  const input = "3 < 5";
  const expected = "3 &lt; 5";
  t.equal(escapeHTML(input), expected, 'should escape "<" to "&lt;"');
});

t.test('should escape ">" character', async (t) => {
  const input = "5 > 3";
  const expected = "5 &gt; 3";
  t.equal(escapeHTML(input), expected, 'should escape ">" to "&gt;"');
});

t.test("should escape '\"' character", async (t) => {
  const input = 'She said "Hello"';
  const expected = "She said &quot;Hello&quot;";
  t.equal(escapeHTML(input), expected, 'should escape \'"\' to "&quot;"');
});

t.test('should escape "\'" character', async (t) => {
  const input = "It's a test";
  const expected = "It&#39;s a test";
  t.equal(escapeHTML(input), expected, 'should escape "\'" to "&#39;"');
});

t.test(
  "should return the same string if no escapable characters are present",
  async (t) => {
    const input = "Hello, world!";
    const expected = "Hello, world!";
    t.equal(
      escapeHTML(input),
      expected,
      "should return the same string if no escapable characters are present"
    );
  }
);

t.test("should handle empty string", async (t) => {
  const input = "";
  const expected = "";
  t.equal(
    escapeHTML(input),
    expected,
    "should return an empty string when input is an empty string"
  );
});

t.test("should handle strings without escapable characters", async (t) => {
  const input = "abcdef";
  const expected = "abcdef";
  t.equal(
    escapeHTML(input),
    expected,
    "should return the same string if there are no escapable characters"
  );
});

t.test(
  "should handle mixed escapable and non-escapable characters",
  async (t) => {
    const input = "Dolce & Gabbana <3";
    const expected = "Dolce &amp; Gabbana &lt;3";
    t.equal(
      escapeHTML(input),
      expected,
      "should escape only escapable characters and leave the rest unchanged"
    );
  }
);
