import * as t from "tap";
import { isSensitiveFile } from "./isSensitiveFile";

t.test("is a sensitive file", async (t) => {
  t.same(isSensitiveFile("/.env"), true);
  t.same(isSensitiveFile("/.ENV"), true);
  t.same(isSensitiveFile("/.bashrc"), true);
  t.same(isSensitiveFile("/.git"), true);
  t.same(isSensitiveFile("/.git/"), true);
  t.same(isSensitiveFile("/.git/test"), true);
  t.same(isSensitiveFile("/.aws/keys.conf"), true);
  t.same(isSensitiveFile("/.ssh/config"), true);
  t.same(isSensitiveFile("/.circleci/config.yml"), true);
  t.same(isSensitiveFile("/.github/secrets"), true);
  t.same(isSensitiveFile("/.docker/config.json"), true);
  t.same(isSensitiveFile("/.env.prod"), true);
  t.same(isSensitiveFile("/backend/.env-Production"), true);
  t.same(isSensitiveFile("/.env.test"), true);
  t.same(isSensitiveFile("/.gitlab-ci.yml"), true);
  t.same(isSensitiveFile("/ci/.travis.yml"), true);
  t.same(isSensitiveFile("/.idea/"), true);
  t.same(isSensitiveFile("/data/db.sqlite"), true);
  t.same(isSensitiveFile("/data/db.sql"), true);
  t.same(isSensitiveFile("/DoCkErFiLe"), true);
  t.same(isSensitiveFile("/docker-compose.yml"), true);
  t.same(isSensitiveFile("/docker-compose.dev.yml"), true);
  t.same(isSensitiveFile("/docker-compose.prod.yaml"), true);
  t.same(isSensitiveFile("/package-lock.json"), true);
  t.same(isSensitiveFile("/static/package.Json"), true);
});

t.test("is not a sensitive file", async (t) => {
  t.same(isSensitiveFile("/test"), false);
  t.same(isSensitiveFile("/.env/"), false);
  t.same(isSensitiveFile("/.env/test"), false);
  t.same(isSensitiveFile("/"), false);
  t.same(isSensitiveFile("/.gitabc"), false);
  t.same(isSensitiveFile("/.gitabc/test"), false);
  t.same(isSensitiveFile("/xenv"), false);
  t.same(isSensitiveFile("/test/"), false);
  t.same(isSensitiveFile("/route/abc/123"), false);
  t.same(isSensitiveFile("/data/db.sqla"), false);
  t.same(isSensitiveFile("/data/sql/a"), false);
});
