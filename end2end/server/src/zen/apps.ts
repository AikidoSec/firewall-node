import { randomInt, timingSafeEqual } from "node:crypto";

export interface App {
  id: number;
  token: string;
  configUpdatedAt: number;
}

const apps: App[] = [];

let id = 1;
export function createApp(): string {
  const appId = id++;
  const token = `AIK_RUNTIME_1_${appId}_${generateRandomString(48)}`;
  apps.push({
    id: appId,
    token,
    configUpdatedAt: Date.now(),
  });
  return token;
}

export function getByToken(token: string): App | undefined {
  return apps.find((app) => {
    if (app.token.length !== token.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(app.token), Buffer.from(token));
  });
}

function generateRandomString(length: number): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const size = chars.length;
  let str = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = randomInt(0, size);
    str += chars[randomIndex];
  }
  return str;
}
