import http from "k6/http";
import { Trend } from "k6/metrics";

export const options = {
  vus: 1,
  duration: "30s",
};

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 204 }));

const payload = {
  title: "Hello, world!",
  text: "This is a test blog post. Lorem ipsum dolor sit amet.",
  authors: ["John Doe", "Jane Doe"],
  metadata: {
    tags: ["test", "blog", "post"],
    createdAt: new Date().toISOString(),
    revisions: {
      count: 1,
      last: new Date().toISOString(),
    },
  },
};

const GET_TREND = new Trend("custom_get_duration");
const POST_TREND = new Trend("custom_post_duration");

export default function () {
  const getRes = http.get("http://localhost:4000/api/posts", {});

  GET_TREND.add(getRes.timings.duration);

  const postRes = http.post(
    "http://localhost:4000/api/posts",
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.Bw8sSk3kdnT9d803kqqE_LZJzY1PzMl5cbmuanQKxrI",
      },
    }
  );

  POST_TREND.add(postRes.timings.duration);
}

export function handleSummary(data) {
  return {
    "result.json": JSON.stringify(data),
  };
}
