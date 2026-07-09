import t from "tap";
import { limitLengthMetadata } from "./limitLengthMetadata";

t.test("it limits metadata length", async () => {
  t.same(limitLengthMetadata({}, 5), {});
  t.same(
    limitLengthMetadata(
      {
        short: "short",
        long: "longer than 5",
      },
      5
    ),
    {
      short: "short",
      long: "longe",
    }
  );
});
