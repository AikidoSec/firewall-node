module.exports = function context() {
  return {
    method: "POST",
    route: "/posts/1234567890",
    headers: {
      accept: "text/fragment+html",
      "accept-language": "nl,en;q=0.9,en-US;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      "x-requested-with": "XMLHttpRequest",
      "Referrer-Policy": "no-referrer-when-downgrade",
      cookie: "a=aaaaaaaaaaaa; b=bbbbbbbbbbbb; c=cccccccccccc; d=dddddddddddd",
    },
    body: {
      a: "aaaaaaaaaaaa",
      b: "bbbbbbbbbbbb",
      c: "cccccccccccc",
      d: "dddddddddddd",
      nested: {
        a: "aaaaaaaaaaaa",
        b: "bbbbbbbbbbbb",
        c: "cccccccccccc",
        d: "dddddddddddd",
        nested: {
          a: "aaaaaaaaaaaa",
          b: "bbbbbbbbbbbb",
          c: "cccccccccccc",
          d: "dddddddddddd",
        },
      },
    },
    remoteAddress: "1.2.3.4",
    url: "https://acme.com/posts/1234567890?a=aaaaaaaaaaaa&b=bbbbbbbbbbbb&c=cccccccccccc&d=dddddddddddd",
    routeParams: {
      id: "1234567890",
    },
    query: {
      a: "aaaaaaaaaaaa",
      b: "bbbbbbbbbbbb",
      c: "cccccccccccc",
      d: "dddddddddddd",
    },
    cookies: {
      a: "aaaaaaaaaaaa",
      b: "bbbbbbbbbbbb",
      c: "cccccccccccc",
      d: "dddddddddddd",
    },
    source: "express",
  };
};
