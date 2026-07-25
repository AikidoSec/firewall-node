import t from "tap";
import { getCurrentAndNextSegments } from "./getCurrentAndNextSegments";

t.test(
  "it puts the current and next items together in a new array",
  async () => {
    t.same(getCurrentAndNextSegments([]), []);
    t.same(getCurrentAndNextSegments(["a"]), []);
    t.same(getCurrentAndNextSegments(["a", "b"]), [
      { currentSegment: "a", nextSegment: "b" },
    ]);
    t.same(getCurrentAndNextSegments(["a", "b", "c"]), [
      { currentSegment: "a", nextSegment: "b" },
      { currentSegment: "b", nextSegment: "c" },
    ]);
    t.same(getCurrentAndNextSegments(["a", "b", "c", "d"]), [
      { currentSegment: "a", nextSegment: "b" },
      { currentSegment: "b", nextSegment: "c" },
      { currentSegment: "c", nextSegment: "d" },
    ]);
  }
);
