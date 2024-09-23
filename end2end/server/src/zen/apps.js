const { randomInt, timingSafeEqual } = require("crypto");

const apps = [];

let id = 1;
function createApp() {
  const appId = id++;
  const token = `AIK_RUNTIME_1_${appId}_${generateRandomString(48)}`;
  const app = {
    id: appId,
    token: token,
    configUpdatedAt: Date.now(),
  };

  apps.push(app);

  return token;
}

function getByToken(token) {
  return apps.find((app) => {
    if (app.token.length !== token.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(app.token), Buffer.from(token));
  });
}

function generateRandomString(length) {
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

module.exports = {
  createApp,
  getByToken,
};
