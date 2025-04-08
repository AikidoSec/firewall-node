import http from "k6/http";
import { Trend } from "k6/metrics";

export const options = {
  vus: 2,
  duration: "60s",
};

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 204 }));

const payload = {
  title: "Hello, world!",
  text: "This is a test blog post. Lorem ipsum dolor sit amet.".repeat(5),
  authors: ["John Doe", "Jane Doe"],
  metadata: {
    tags: ["test", "blog", "post"],
    createdAt: new Date().toISOString(),
    revisions: {
      count: 1,
      last: new Date().toISOString(),
    },
  },
  user: {
    id: "1234-5678-9012",
    hash: "464a216fea78779d5d75414ddaf13b1adbd7deca8c25871d9644e72ebfb642a3",
  },
  morePayload: {
    base64: "bG9yZW0gaXBzdW0gZG9sb3Igc2V0IGFtZWQuLi4uLi4uYWJjZGVmaGlqa2xtbm9w",
    array: [
      {
        keyA: "abcdefg",
        keyB: 42,
        bool: true,
      },
      {
        keyA: "hello_world_string",
        keyB: 43,
        bool: false,
      },
    ],
  },
  _version: 1,
  platform: "web",
  source: "k6",
};

const headers = {
  Authorization:
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.Bw8sSk3kdnT9d803kqqE_LZJzY1PzMl5cbmuanQKxrI",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  Dnt: "1",
  Priority: "u=0, i",
  "Sec-Ch-Ua":
    '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
  "Sec-Ch-Ua-Arch": '"arm"',
  "Sec-Ch-Ua-Bitness": '"64"',
  "Sec-Ch-Ua-Full-Version-List":
    '"Not)A;Brand";v="99.0.0.0", "Google Chrome";v="127.0.6533.72", "Chromium";v="127.0.6533.72"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Model": '""',
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Ch-Ua-Platform-Version": '"14.5.0"',
  "Sec-Ch-Ua-Wow64": "?0",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-User": "?1",
  "Sec-Gpc": "1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
};

function buildTestTrends(prefix) {
  return {
    delta: new Trend(`${prefix}_delta`),
    with_zen: new Trend(`${prefix}_with_zen`),
    without_zen: new Trend(`${prefix}_without_zen`),
  };
}

const getTrends = buildTestTrends("get");
const postTrends = buildTestTrends("post");

export default function () {
  const getWithZen = http.get("http://localhost:4000/api/posts", {
    headers: headers,
  });
  const getWithoutZen = http.get("http://localhost:4001/api/posts", {
    headers: headers,
  });

  getTrends.with_zen.add(getWithZen.timings.waiting);
  getTrends.without_zen.add(getWithoutZen.timings.waiting);
  getTrends.delta.add(
    getWithZen.timings.waiting - getWithoutZen.timings.waiting
  );

  const postWithZen = http.post(
    "http://localhost:4000/api/posts",
    JSON.stringify(payload),
    {
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    }
  );
  const postWithoutZen = http.post(
    "http://localhost:4001/api/posts",
    JSON.stringify(payload),
    {
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    }
  );

  postTrends.with_zen.add(postWithZen.timings.waiting);
  postTrends.without_zen.add(postWithoutZen.timings.waiting);
  postTrends.delta.add(
    postWithZen.timings.waiting - postWithoutZen.timings.waiting
  );
}

export function handleSummary(data) {
  return {
    "result.json": JSON.stringify(data),
  };
}
