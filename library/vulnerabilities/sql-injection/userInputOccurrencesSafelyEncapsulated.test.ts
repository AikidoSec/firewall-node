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
    t.same(userInputOccurrencesSafelyEncapsulated("`UNION`", "UNION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated("`U`NION`", "U`NION"), false);
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
    t.same(userInputOccurrencesSafelyEncapsulated(`"UN'ION"`, "UN'ION"), true);
    t.same(userInputOccurrencesSafelyEncapsulated(`'UN"ION'`, 'UN"ION'), true);
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UN"ION' AND id = "UN'ION"`,
        'UN"ION'
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UN'ION' AND id = "UN'ION"`,
        `UN'ION`
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\'`,
        "UNION\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\\\'`,
        "UNION\\\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\\\\\'`,
        "UNION\\\\\\"
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `SELECT * FROM cats WHERE id = 'UNION\\n'`,
        "UNION\\n"
      ),
      true
    );
  }
);
