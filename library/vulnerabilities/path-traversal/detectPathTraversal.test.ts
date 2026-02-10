import * as t from "tap";
import { detectPathTraversal } from "./detectPathTraversal";

t.test("empty user input", async () => {
  t.same(detectPathTraversal("test.txt", ""), false);
});

t.test("empty file input", async () => {
  t.same(detectPathTraversal("", "test"), false);
});

t.test("empty user input and file input", async () => {
  t.same(detectPathTraversal("", ""), false);
});

t.test("user input is a single character", async () => {
  t.same(detectPathTraversal("test.txt", "t"), false);
});

t.test("file input is a single character", async () => {
  t.same(detectPathTraversal("t", "test"), false);
});

t.test("same as user input", async () => {
  t.same(detectPathTraversal("text.txt", "text.txt"), false);
});

t.test("with directory before", async () => {
  t.same(detectPathTraversal("directory/text.txt", "text.txt"), false);
});

t.test("with both directory before", async () => {
  t.same(
    detectPathTraversal("directory/text.txt", "directory/text.txt"),
    false
  );
});

t.test("user input and file input are single characters", async () => {
  t.same(detectPathTraversal("t", "t"), false);
});

t.test("it flags ../", async () => {
  t.same(detectPathTraversal("../test.txt", "../"), true);
});

t.test("it flags ..\\", async () => {
  t.same(detectPathTraversal("..\\test.txt", "..\\"), true);
});

t.test("it flags ../../", async () => {
  t.same(detectPathTraversal("../../test.txt", "../../"), true);
});

t.test("it flags ..\\..\\", async () => {
  t.same(detectPathTraversal("..\\..\\test.txt", "..\\..\\"), true);
});

t.test("it flags ../../../../", async () => {
  t.same(detectPathTraversal("../../../../test.txt", "../../../../"), true);
});

t.test("it flags ..\\..\\..\\", async () => {
  t.same(detectPathTraversal("..\\..\\..\\test.txt", "..\\..\\..\\"), true);
});

t.test("it flags ./../", async () => {
  t.same(detectPathTraversal("./../test.txt", "./../"), true);
});

t.test("user input is longer than file path", async () => {
  t.same(detectPathTraversal("../file.txt", "../../file.txt"), false);
});

t.test("absolute linux path", async () => {
  t.same(detectPathTraversal("/etc/passwd", "/etc/passwd"), true);
});

t.test("linux user directory", async () => {
  t.same(detectPathTraversal("/home/user/file.txt", "/home/user/"), true);
});

t.test("possible bypass", async () => {
  t.same(detectPathTraversal("/./etc/passwd", "/./etc/passwd"), true);
});

t.test("another bypass", async () => {
  t.same(
    detectPathTraversal("/./././root/test.txt", "/./././root/test.txt"),
    true
  );
  t.same(detectPathTraversal("/./././root/test.txt", "/./././root"), true);
});

t.test("no path traversal", async () => {
  t.same(
    detectPathTraversal("/appdata/storage/file.txt", "/storage/file.txt"),
    false
  );
});

t.test("does not flag test", async () => {
  t.same(detectPathTraversal("/app/test.txt", "test"), false);
});

t.test("does not flag example/test.txt", async () => {
  t.same(
    detectPathTraversal("/app/data/example/test.txt", "example/test.txt"),
    false
  );
});

t.test("does not absolute path with different folder", async () => {
  t.same(detectPathTraversal("/etc/app/config", "/etc/hack/config"), false);
});

t.test("does not absolute path inside another folder", async () => {
  t.same(detectPathTraversal("/etc/app/data/etc/config", "/etc/config"), false);
});

t.test("disable checkPathStart", async () => {
  t.same(detectPathTraversal("/etc/passwd", "/etc/passwd", false), false);
});

t.test(
  "windows drive letter",
  { skip: process.platform !== "win32" ? "Windows only" : false },
  async () => {
    t.same(detectPathTraversal("C:\\file.txt", "C:\\"), true);
  }
);

t.test(
  "does not detect if user input path contains no filename or subfolder",
  async () => {
    t.same(detectPathTraversal("/etc/app/test.txt", "/etc/"), false);
    t.same(detectPathTraversal("/etc/app/", "/etc/"), false);
    t.same(detectPathTraversal("/etc/app/", "/etc"), false);
    t.same(detectPathTraversal("/etc/", "/etc/"), false);
    t.same(detectPathTraversal("/etc", "/etc"), false);
    t.same(detectPathTraversal("/var/a", "/var/"), false);
    t.same(detectPathTraversal("/var/a", "/var/b"), false);
    t.same(detectPathTraversal("/var/a", "/var/b/test.txt"), false);
  }
);

t.test(
  "it does detect if user input path contains a filename or subfolder",
  async () => {
    t.same(detectPathTraversal("/etc/app/file.txt", "/etc/app"), true);
    t.same(detectPathTraversal("/etc/app/file.txt", "/etc/app/file.txt"), true);
    t.same(detectPathTraversal("/var/backups/file.txt", "/var/backups"), true);
    t.same(
      detectPathTraversal("/var/backups/file.txt", "/var/backups/file.txt"),
      true
    );
    t.same(detectPathTraversal("/var/a", "/var/a"), true);
    t.same(detectPathTraversal("/var/a/b", "/var/a"), true);
    t.same(detectPathTraversal("/var/a/b/test.txt", "/var/a"), true);
  }
);

t.test("absolute macOS path", async () => {
  t.same(
    detectPathTraversal("/Applications/Zen.app", "/Applications/Zen.app"),
    true
  );
  t.same(detectPathTraversal("/Users/user/test.txt", "/Users/user/"), true);
  t.same(
    detectPathTraversal(
      "/Volumes/ExternalDrive/test.txt",
      "/Volumes/ExternalDrive/"
    ),
    true
  );
});

t.test("container /app/ directory", async () => {
  t.same(detectPathTraversal("/app/config/secret.yml", "/app/config"), true);
  t.same(
    detectPathTraversal("/app/config/secret.yml", "/app/config/secret.yml"),
    true
  );
  t.same(detectPathTraversal("/app/test.txt", "/app/"), false);
  t.same(detectPathTraversal("/app/test.txt", "/app"), false);
});

t.test("container /code/ directory", async () => {
  t.same(detectPathTraversal("/code/src/index.js", "/code/src"), true);
  t.same(detectPathTraversal("/code/src/index.js", "/code/src/index.js"), true);
  t.same(detectPathTraversal("/code/test.txt", "/code/"), false);
  t.same(detectPathTraversal("/code/test.txt", "/code"), false);
});

t.test("AWS credentials protection", async () => {
  t.same(
    detectPathTraversal(
      "/home/user/.aws/credentials",
      "/home/user/.aws/credentials"
    ),
    true
  );
});
