import * as t from "tap";
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

t.test("it does not result in an infinite loop", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com/2"),
        },
        {
          source: new URL("https://example.com/2"),
          destination: new URL("https://example.com"),
        },
      ],
      new URL("https://example.com")
    ),
    undefined
  );
});

t.test(
  "it avoids infinite loops with unrelated cyclic redirects",
  async (t) => {
    t.equal(
      getRedirectOrigin(
        [
          // Unrelated cyclic redirects
          {
            source: new URL("https://cycle.com/a"),
            destination: new URL("https://cycle.com/b"),
          },
          {
            source: new URL("https://cycle.com/b"),
            destination: new URL("https://cycle.com/c"),
          },
          {
            source: new URL("https://cycle.com/c"),
            destination: new URL("https://cycle.com/a"),
          },
          // Relevant redirects
          {
            source: new URL("https://start.com"),
            destination: new URL("https://middle.com"),
          },
          {
            source: new URL("https://middle.com"),
            destination: new URL("https://end.com"),
          },
        ],
        new URL("https://end.com")
      )?.href,
      new URL("https://start.com").href
    );
  }
);

t.test("it handles multiple requests with overlapping redirects", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        // Overlapping redirects
        {
          source: new URL("https://site1.com"),
          destination: new URL("https://site2.com"),
        },
        {
          source: new URL("https://site2.com"),
          destination: new URL("https://site3.com"),
        },
        {
          source: new URL("https://site3.com"),
          destination: new URL("https://site1.com"), // Cycle
        },
        // Relevant redirects
        {
          source: new URL("https://origin.com"),
          destination: new URL("https://destination.com"),
        },
      ],
      new URL("https://destination.com")
    )?.href,
    new URL("https://origin.com").href
  );
});

t.test(
  "it avoids infinite loops when cycles are part of the redirect chain",
  async (t) => {
    t.equal(
      getRedirectOrigin(
        [
          {
            source: new URL("https://start.com"),
            destination: new URL("https://loop.com/a"),
          },
          {
            source: new URL("https://loop.com/a"),
            destination: new URL("https://loop.com/b"),
          },
          {
            source: new URL("https://loop.com/b"),
            destination: new URL("https://loop.com/c"),
          },
          {
            source: new URL("https://loop.com/c"),
            destination: new URL("https://loop.com/a"), // Cycle here
          },
        ],
        new URL("https://loop.com/b")
      )?.href,
      new URL("https://start.com").href
    );
  }
);

t.test("it handles redirects with query parameters", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com?param=value"),
        },
      ],
      new URL("https://example.com?param=value")
    )?.href,
    new URL("https://example.com").href
  );
});

t.test("it handles redirects with fragment identifiers", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com#section"),
        },
      ],
      new URL("https://example.com#section")
    )?.href,
    new URL("https://example.com").href
  );
});

t.test("it handles redirects with different protocols", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("http://example.com"),
          destination: new URL("https://example.com"),
        },
      ],
      new URL("https://example.com")
    )?.href,
    new URL("http://example.com").href
  );
});

t.test("it handles redirects with different ports", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com:8080"),
        },
      ],
      new URL("https://example.com:8080")
    )?.href,
    new URL("https://example.com").href
  );
});

t.test("it handles redirects with paths", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com/home"),
        },
        {
          source: new URL("https://example.com/home"),
          destination: new URL("https://example.com/home/welcome"),
        },
      ],
      new URL("https://example.com/home/welcome")
    )?.href,
    new URL("https://example.com").href
  );
});

t.test("it handles multiple redirects to the same destination", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://a.com"),
          destination: new URL("https://d.com"),
        },
        {
          source: new URL("https://b.com"),
          destination: new URL("https://d.com"),
        },
        {
          source: new URL("https://c.com"),
          destination: new URL("https://d.com"),
        },
      ],
      new URL("https://d.com")
    )?.href,
    new URL("https://a.com").href // It will return the first matching source
  );
});

t.test("it handles multiple redirect paths to the same URL", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://x.com"),
          destination: new URL("https://y.com"),
        },
        {
          source: new URL("https://y.com"),
          destination: new URL("https://z.com"),
        },
        {
          source: new URL("https://a.com"),
          destination: new URL("https://b.com"),
        },
        {
          source: new URL("https://b.com"),
          destination: new URL("https://z.com"),
        },
      ],
      new URL("https://z.com")
    )?.href,
    new URL("https://x.com").href // It follows the first matching path
  );
});

t.test(
  "it returns undefined when source and destination are the same URL",
  async (t) => {
    t.equal(
      getRedirectOrigin(
        [
          {
            source: new URL("https://example.com"),
            destination: new URL("https://example.com"),
          },
        ],
        new URL("https://example.com")
      ),
      undefined
    );
  }
);

t.test("it handles very long redirect chains", async (t) => {
  const redirects = [];
  for (let i = 0; i < 100; i++) {
    redirects.push({
      source: new URL(`https://example.com/${i}`),
      destination: new URL(`https://example.com/${i + 1}`),
    });
  }

  t.equal(
    getRedirectOrigin(redirects, new URL("https://example.com/100"))?.href,
    new URL("https://example.com/0").href
  );
});

t.test(
  "it handles redirects with cycles longer than one redirect",
  async (t) => {
    t.equal(
      getRedirectOrigin(
        [
          {
            source: new URL("https://a.com"),
            destination: new URL("https://b.com"),
          },
          {
            source: new URL("https://b.com"),
            destination: new URL("https://c.com"),
          },
          {
            source: new URL("https://c.com"),
            destination: new URL("https://a.com"),
          },
        ],
        new URL("https://a.com")
      ),
      undefined
    );
  }
);

t.test("it handles redirects with different query parameters", async (t) => {
  t.equal(
    getRedirectOrigin(
      [
        {
          source: new URL("https://example.com"),
          destination: new URL("https://example.com?param=1"),
        },
        {
          source: new URL("https://example.com?param=1"),
          destination: new URL("https://example.com?param=2"),
        },
      ],
      new URL("https://example.com?param=2")
    )?.href,
    new URL("https://example.com").href
  );
});
