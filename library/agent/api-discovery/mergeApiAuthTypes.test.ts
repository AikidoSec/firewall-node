import * as t from "tap";
import { mergeApiAuthTypes as merge } from "./mergeApiAuthTypes";

t.test("it works", async (t) => {
  t.same(
    merge(
      [
        {
          type: "http",
          scheme: "bearer",
        },
        {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      ],
      [
        {
          type: "http",
          scheme: "bearer",
        },
        {
          type: "http",
          scheme: "basic",
        },
        {
          type: "apiKey",
          in: "header",
          name: "x-api-key-v2",
        },
      ]
    ),
    [
      {
        type: "http",
        scheme: "bearer",
      },
      {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
      {
        type: "http",
        scheme: "basic",
      },
      {
        type: "apiKey",
        in: "header",
        name: "x-api-key-v2",
      },
    ]
  );

  t.same(merge(undefined, undefined), undefined);

  t.same(
    merge(
      [
        {
          type: "http",
          scheme: "bearer",
        },
      ],
      undefined
    ),
    [
      {
        type: "http",
        scheme: "bearer",
      },
    ]
  );

  t.same(
    merge(undefined, [
      {
        type: "http",
        scheme: "digest",
      },
    ]),
    [
      {
        type: "http",
        scheme: "digest",
      },
    ]
  );
});
