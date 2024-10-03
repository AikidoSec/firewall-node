import t from "tap";
import { getRedirectOrigin } from "./getRedirectOrigin";

t.test("it gets the origin URL of a redirect", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://hackers.com"),
        },
      ],

      new URL("https://hackers.com")
    )?.hostname,
    "example.com"
  );

  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com/2"),
        },
        {
          source: new URL("https://example.com/2"),
          destination: new URL("https://hackers.com/test"),
        },
      ],

      new URL("https://hackers.com/test")
    )?.href,
    new URL("https://example.com").href
  );
});

t.test("it returns undefined if there are no redirects", async (t) => {
  t.equal(getRedirectOrigin([], new URL("https://hackers.com")), undefined);
  t.equal(
    getRedirectOrigin(undefined, new URL("https://hackers.com")),
    undefined
  );
});

t.test("it returns undefined if the URL is not a destination", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://hackers.com"),
        },
      ],
      new URL("https://example.com")
    ),
    undefined
  );
});

t.test("it returns undefined if the URL is not in the redirects", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://hackers.com"),
        },
      ],
      new URL("https:example.com")
    ),
    undefined
  );
});

t.test(
  "it returns the hostname if the url is in the middle of multiple redirects",
  async (t) => {
    t.equal(
      getRedirectOrigin(
        [
          {
            source: new URL("https://example.com"),
            destination: new URL("https://example.com/2"),
          },
          {
            source: new URL("https://example.com/2"),
            destination: new URL("https://hackers.com/test"),
          },
          {
            source: new URL("https://hackers.com/test"),
            destination: new URL("https://another.com"),
          },
        ],
        new URL("https://hackers.com/test")
      )?.hostname,
      "example.com"
    );
  }
);
