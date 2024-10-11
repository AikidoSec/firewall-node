// Source: https://github.com/uuidjs/uuid/blob/main/src/regex.ts
// MIT License - Copyright (c) 2010-2020 Robert Kieffer and other contributors
const regex =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export default function isUUIDString(str: string) {
  return regex.test(str);
}
