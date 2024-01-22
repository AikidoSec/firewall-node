export function moduleExists(name: string) {
  try {
    require.resolve(name);
  } catch (err: any) {
    console.log("err ", err.code);
    if (err.code === "MODULE_NOT_FOUND") {
      return false;
    }
  }

  return true;
}
