export async function checkHooks() {
  let success = false;

  try {
    const imported = await import("./zenHooksCheckImport");

    if (imported.test() === ":)") {
      success = true;
    }
  } catch {
    //
  }

  if (!success) {
    // eslint-disable-next-line no-console
    console.warn(
      `AIKIDO: A self check of the code instrumentation failed. This means that the protection might not work as expected.`
    );
  }
}
