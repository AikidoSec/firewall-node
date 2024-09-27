import { Hook, createAddHookMessageChannel } from "import-in-the-middle";
import { register } from "module";
import { pathToFileURL } from "url";

// Todo init agent?

const { registerOptions, waitForAllMessagesAcknowledged } =
  createAddHookMessageChannel();

register(
  "import-in-the-middle/hook.mjs",
  pathToFileURL(__filename),
  // @ts-ignore test
  registerOptions
);

// Todo
