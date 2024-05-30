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

t.test("user input is longer than file path", async () => {
  t.same(detectPathTraversal("../file.txt", "../../file.txt"), false);
});

t.test("absolute linux path", async () => {
  t.same(detectPathTraversal("/etc/passwd", "/etc/passwd"), true);
});

t.test("linux user directory", async () => {
  t.same(detectPathTraversal("/home/user/file.txt", "/home/user/"), true);
});

t.test("windows drive letter", async () => {
  t.same(detectPathTraversal("C:\\file.txt", "C:\\"), true);
});

t.test("no path traversal", async () => {
  t.same(
    detectPathTraversal("/appdata/storage/file.txt", "/storage/file.txt"),
    false
  );
});
