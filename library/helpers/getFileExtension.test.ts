import * as t from "tap";
import { getFileExtension } from "./getFileExtension";

t.test("it works", async () => {
  t.equal(getFileExtension("file.txt"), "txt");
  t.equal(getFileExtension("file.tar.gz"), "gz");
  t.equal(getFileExtension(".file.txt"), "txt");
  t.equal(getFileExtension("font.woff2"), "woff2");
  t.equal(getFileExtension("/path/to/file.txt"), "txt");

  t.equal(getFileExtension("file"), "");
  t.equal(getFileExtension("file."), "");
  t.equal(getFileExtension("file.."), "");
  t.equal(getFileExtension("file.txt."), "");
});
