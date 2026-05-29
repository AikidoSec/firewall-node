import * as t from "tap";
import { Context } from "../agent/Context";
import { getSourceForUserString } from "./getSourceForUserString";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://local.aikido.io",
    query: {},
    headers: {},
    body: {
      image: "http://localhost:4000/api/internal",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.test(
  "it returns undefined if the user string cannot be found in the context",
  async () => {
    t.same(getSourceForUserString(createContext(), "unknown"), undefined);
  }
);

t.test(
  "it returns source if the user string is found in the context",
  async () => {
    t.same(
      getSourceForUserString(
        createContext(),
        "http://localhost:4000/api/internal"
      ),
      "body"
    );
  }
);

t.test(
  "it returns 'files' source when the user string is in multipart file metadata",
  async () => {
    const context = createContext();
    context.files = [
      {
        fieldname: "document",
        originalname: "' OR '1'='1",
        encoding: "7bit",
        mimetype: "application/pdf",
      },
    ];
    t.same(getSourceForUserString(context, "' OR '1'='1"), "files");
  }
);

t.test(
  "it returns 'files' source when the user string is in the filename of the second file",
  async () => {
    const context = createContext();
    context.files = [
      {
        fieldname: "photo",
        filename: "benign.jpg",
        encoding: "7bit",
        mimeType: "image/jpeg",
      },
      {
        fieldname: "attachment",
        filename: "../../etc/passwd",
        encoding: "7bit",
        mimeType: "text/plain",
      },
    ];
    t.same(getSourceForUserString(context, "../../etc/passwd"), "files");
  }
);

t.test(
  "it returns 'files' source when the user string matches a mimeType field",
  async () => {
    const context = createContext();
    context.files = [
      {
        fieldname: "upload",
        filename: "safe.txt",
        encoding: "7bit",
        mimeType: "'; DROP TABLE users; --",
      },
    ];
    t.same(getSourceForUserString(context, "'; DROP TABLE users; --"), "files");
  }
);

t.test("it returns undefined when files array is empty", async () => {
  const context = createContext();
  context.files = [];
  t.same(getSourceForUserString(context, "anything"), undefined);
});

t.test(
  "it returns 'files' source when files is a single object (req.file style)",
  async () => {
    const context = createContext();
    context.files = {
      fieldname: "avatar",
      originalname: "; rm -rf /",
      encoding: "7bit",
      mimetype: "image/png",
    };
    t.same(getSourceForUserString(context, "; rm -rf /"), "files");
  }
);
