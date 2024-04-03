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
