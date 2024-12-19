import * as t from "tap";
import { getMetadataForSSRFAttack } from "./getMetadataForSSRFAttack";

t.test("port is undefined", async () => {
  t.same(
    getMetadataForSSRFAttack({
      hostname: "example.com",
      port: undefined,
    }),
    {
      hostname: "example.com",
    }
  );
});

t.test("port is defined", async () => {
  t.same(
    getMetadataForSSRFAttack({
      hostname: "example.com",
      port: 80,
    }),
    {
      hostname: "example.com",
      port: "80",
    }
  );
});

t.test("port is 443", async () => {
  t.same(
    getMetadataForSSRFAttack({
      hostname: "example.com",
      port: 443,
    }),
    {
      hostname: "example.com",
      port: "443",
    }
  );
});

t.test("port is 0", async () => {
  t.same(
    getMetadataForSSRFAttack({
      hostname: "example.com",
      port: 0,
    }),
    {
      hostname: "example.com",
      port: "0",
    }
  );
});
