import * as t from "tap";
import { getRedirectOriginHostname } from "./getRedirectOriginHostname";

t.test("it gets the origin URL of a redirect", async (t) => {
  t.equal(
    getRedirectOriginHostname(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://hackers.com"),
        },
      ],

      new URL("https://hackers.com")
    ),
    "example.com"
  );

  t.equal(
    getRedirectOriginHostname(
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
    ),
    "example.com"
  );
});

t.test("it returns undefined if there are no redirects", async (t) => {
  t.equal(
    getRedirectOriginHostname([], new URL("https://hackers.com")),
    undefined
  );
});

t.test("it returns undefined if the URL is not a destination", async (t) => {
  t.equal(
    getRedirectOriginHostname(
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
    getRedirectOriginHostname(
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
      getRedirectOriginHostname(
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
      ),
      "example.com"
    );
  }
);
