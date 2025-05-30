import * as t from "tap";
import { formDataToPlainObject } from "./formDataToPlainObject";

t.test(
  "simple",
  {
    skip: !globalThis.FormData
      ? "This Node.js version does not support FormData yet"
      : false,
  },
  async (t) => {
    const formData = new FormData();
    formData.append("abc", "123");
    formData.append("another", "42");
    formData.append("hello", "world");

    t.same(formDataToPlainObject(formData), {
      abc: "123",
      another: "42",
      hello: "world",
    });
  }
);

t.test(
  "with arrays",
  {
    skip: !globalThis.FormData
      ? "This Node.js version does not support FormData yet"
      : false,
  },
  async (t) => {
    const formData = new FormData();
    formData.append("abc", "123");
    formData.append("arr", "1");
    formData.append("arr", "2");
    formData.append("arr", "3");

    t.same(formDataToPlainObject(formData), {
      abc: "123",
      arr: ["1", "2", "3"],
    });
  }
);

t.test(
  "binary data",
  {
    skip:
      !globalThis.FormData || !globalThis.File
        ? "This Node.js version does not support FormData or File yet"
        : false,
  },
  async (t) => {
    const formData = new FormData();
    formData.append("abc", "123");
    formData.append("arr", "2");
    formData.append("arr", "3");
    formData.append(
      "file",
      new File(["hello"], "hello.txt", { type: "text/plain" })
    );

    t.same(formDataToPlainObject(formData), {
      abc: "123",
      arr: ["2", "3"],
    });
  }
);
