import http from "k6/http";

export const options = {
  vus: 10,
  duration: "30s",
};

const url = "http://localhost:4001/login";

export default function () {
  const payload = JSON.stringify({ email: "email", password: "password" });
  const headers = { "Content-Type": "application/json" };
  http.post(url, payload, { headers: headers });
}
