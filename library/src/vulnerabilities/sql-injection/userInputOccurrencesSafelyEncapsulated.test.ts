import * as t from "tap";
import { userInputOccurrencesSafelyEncapsulated } from "./userInputOccurrencesSafelyEncapsulated";

t.test(
  "Test the userInputOccurrencesSafelyEncapsulated() function",
  async () => {
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        ` Hello Hello 'UNION'and also "UNION" `,
        "UNION"
      ),
      true
    );
    t.same(userInputOccurrencesSafelyEncapsulated(`"UNION"`, "UNION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated(` 'UNION' `, "UNION"), true);
    t.same(
      userInputOccurrencesSafelyEncapsulated(`"UNION"'UNION'`, "UNION"),
      true
    );

    t.same(
      userInputOccurrencesSafelyEncapsulated(`'UNION'"UNION"UNION`, "UNION"),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(`'UNION'UNION"UNION"`, "UNION"),
      false
    );
    t.same(userInputOccurrencesSafelyEncapsulated("UNION", "UNION"), false);
  }
);
