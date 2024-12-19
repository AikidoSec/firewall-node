import http from "k6/http";
import { Trend } from "k6/metrics";

export const options = {
  vus: 1,
  duration: "30s",
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
  "Content-Type": "application/json",
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

const GET_TREND = new Trend("custom_get_duration");
const POST_TREND = new Trend("custom_post_duration");

export default function () {
  const getRes = http.get("http://localhost:4000/api/posts", {
    headers: headers,
  });

  GET_TREND.add(getRes.timings.duration);

  const postRes = http.post(
    "http://localhost:4000/api/posts",
    JSON.stringify(payload),
    {
      headers: headers,
    }
  );

  POST_TREND.add(postRes.timings.duration);
}

export function handleSummary(data) {
  return {
    "result.json": JSON.stringify(data),
  };
}
